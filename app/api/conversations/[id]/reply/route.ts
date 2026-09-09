import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getValidToken, getValidMetaToken } from '@/lib/platform/tokens'
import { getTelegramToken, TELEGRAM_API } from '@/lib/platform/telegram'
import { decryptToken } from '@/lib/crypto/tokenCipher'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'
import { metaDebug } from '@/lib/log/debug'
import { appsecretProof } from '@/lib/platform/appsecretProof'
import { zernioEnabled, sendZernioMessage, resolveZernioAccountId } from '@/lib/platform/zernio'
import { multiUserEnabled, scopedUserId } from '@/lib/auth/currentUser'

const META_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

interface SendResult {
  ok: boolean
  status: 'sent' | 'failed' | 'local_only'
  error?: string
}

// Turn raw platform/Zernio send errors into something a creator can act on.
// Meta's cryptic codes (e.g. "(#3) Application does not have the capability…")
// mean a permission wasn't granted on the connected account — not a bug in the
// app — so tell them to reconnect with messaging enabled. Unknown errors pass
// through unchanged.
function friendlyMessagingError(raw: string | undefined, platform: string): string {
  const msg = raw ?? 'Message was not sent'
  const label = platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : platform
  const lower = msg.toLowerCase()
  // #3 capability / #10 permission / "permission" / "not authorized" → messaging
  // scope missing on the connection.
  if (
    lower.includes('does not have the capability') ||
    lower.includes('(#3)') ||
    lower.includes('(#10)') ||
    lower.includes('permission') ||
    lower.includes('not authorized') ||
    lower.includes('cannot message users')
  ) {
    return `${label} hasn't granted permission to send messages from this account. Reconnect it in Settings and allow messaging when prompted. If it still fails after reconnecting, messaging may need to be enabled for this account by support.`
  }
  return msg
}

async function sendReply(conv: Record<string, unknown>, body: string): Promise<SendResult> {
  const platform = conv.platform as string

  if (platform === 'instagram' || platform === 'facebook') {
    // When Zernio is the messaging provider, send through its unified inbox.
    // external_thread_id holds Zernio's conversationId (see the Zernio webhook).
    // Zernio/Meta still enforce the 24h window server-side and return an error
    // we surface, so no separate window check is needed here.
    if (zernioEnabled()) {
      // Zernio's send endpoint requires the sending accountId. In multi-user
      // mode send from the conversation OWNER's connected account; otherwise
      // (single-creator) resolve the one account for this platform.
      let accountId: string | undefined
      if (multiUserEnabled() && conv.user_id) {
        const { data: za } = await adminSupabase
          .from('zernio_accounts')
          .select('zernio_account_id')
          .eq('user_id', conv.user_id as string)
          .eq('platform', platform)
          .maybeSingle()
        accountId = za?.zernio_account_id as string | undefined
      } else {
        accountId = await resolveZernioAccountId(platform)
      }
      if (!accountId) {
        return { ok: false, status: 'failed', error: `No Zernio ${platform} account is connected to send from.` }
      }
      const r = await sendZernioMessage(conv.external_thread_id as string, accountId, body)
      return r.ok
        ? { ok: true, status: 'sent' }
        : { ok: false, status: 'failed', error: friendlyMessagingError(r.error, platform) }
    }

    // Meta requires an inbound message within the last 24h (or an approved
    // message tag, which this app doesn't implement) to send outside a live
    // human-agent window. Enforce it here rather than letting Meta silently
    // reject the send — see CLAUDE.md.
    const { data: lastInbound } = await adminSupabase
      .from('messages')
      .select('sent_at')
      .eq('conversation_id', conv.id as string)
      .eq('direction', 'inbound')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastInboundAt = lastInbound?.sent_at ? new Date(lastInbound.sent_at).getTime() : null
    if (!lastInboundAt || Date.now() - lastInboundAt > META_MESSAGING_WINDOW_MS) {
      return {
        ok: false,
        status: 'failed',
        error: `Outside Meta's 24-hour messaging window (last inbound message was ${lastInboundAt ? new Date(lastInboundAt).toISOString() : 'never'}). Sending without an approved message tag would be rejected by ${platform === 'instagram' ? 'Instagram' : 'Facebook'} — this app does not implement message tags, so the reply was not sent.`,
      }
    }

    const { data: conn } = await adminSupabase
      .from('platform_connections')
      .select('access_token, account_id')
      .eq('platform', platform)
      .limit(1)
      .single()

    if (!conn) {
      return { ok: false, status: 'failed', error: `No ${platform} connection found` }
    }

    let rawToken: string
    try {
      rawToken = await getValidMetaToken(platform as 'facebook' | 'instagram', conn.account_id as string)
    } catch {
      rawToken = decryptToken(conn.access_token as string)!
    }
    // A token pasted into a SQL editor (or otherwise stored by hand) often
    // carries a trailing newline/space; sent as a query param that becomes an
    // invalid token and Meta returns a bare "unknown error" (code 1). Trim it.
    const token = rawToken.trim()
    if (token.length !== rawToken.length) {
      metaDebug('[reply-debug] stored token had surrounding whitespace — trimmed', rawToken.length, '->', token.length)
    }

    const sendPayload: Record<string, unknown> = {
      recipient: { id: conv.external_thread_id },
      message: { text: body },
    }
    if (platform === 'facebook') {
      sendPayload.messaging_type = 'RESPONSE'
    }

    // Send API wants form-urlencoded params with the nested values as JSON
    // strings and the access_token in the query string.
    const form = new URLSearchParams()
    for (const [key, value] of Object.entries(sendPayload)) {
      form.set(key, typeof value === 'string' ? value : JSON.stringify(value))
    }

    // Include appsecret_proof so the call still succeeds if the app requires
    // proof for server-side Graph calls (Meta increasingly defaults this on).
    const proof = appsecretProof(token, platform as 'facebook' | 'instagram')
    const proofQuery = proof ? `&appsecret_proof=${proof}` : ''
    // Instagram is connected via Instagram Login, so its token is issued by the
    // Instagram app and ONLY works against graph.instagram.com (me/messages).
    // Sending IG DMs via graph.facebook.com fails with a bare OAuthException —
    // this was the unresolved "code 1" for Instagram. Facebook Page tokens use
    // graph.facebook.com/{page-id}/messages. Route each to its own host.
    const sendUrl =
      platform === 'instagram'
        ? `https://graph.instagram.com/${META_GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(token)}${proofQuery}`
        : `https://graph.facebook.com/${META_GRAPH_VERSION}/${conn.account_id}/messages?access_token=${encodeURIComponent(token)}${proofQuery}`
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    })
    // TEMPORARY DIAGNOSTIC — read the full raw body; the generic code 1 error
    // hides its real cause in error_data/error_user_msg, which JSON-picking
    // `error` alone drops. Log the whole request context + raw response.
    const rawResponse = await res.text()
    let data: {
      error?: {
        message: string
        type?: string
        code?: number
        error_subcode?: number
        error_user_title?: string
        error_user_msg?: string
        fbtrace_id?: string
      }
    } = {}
    try {
      data = JSON.parse(rawResponse)
    } catch {
      /* non-JSON body — rawResponse logged below */
    }
    if (!res.ok || data.error) {
      // Operational error line — Meta's own error metadata only (no message
      // content or token), safe for prod logs. subcode + error_user_msg carry
      // the real reason a bare "code 1" hides.
      console.error(
        '[reply] Meta send failed.',
        'platform:', platform,
        '| status:', res.status,
        '| code:', data.error?.code ?? 'n/a',
        '| subcode:', data.error?.error_subcode ?? 'n/a',
        '| type:', data.error?.type ?? 'n/a',
        '| user_title:', data.error?.error_user_title ?? 'n/a',
        '| user_msg:', data.error?.error_user_msg ?? 'n/a',
        '| fbtrace:', data.error?.fbtrace_id ?? 'n/a'
      )
      // Full context (includes the outbound message body) only when explicitly
      // debugging — see lib/log/debug.ts.
      metaDebug(
        '[reply-debug] Meta send failed. status:', res.status,
        '| version:', META_GRAPH_VERSION,
        '| endpoint:', `${conn.account_id}/messages`,
        '| tokenLen:', token.length,
        '| payload:', JSON.stringify(sendPayload),
        '| raw:', rawResponse
      )
      return { ok: false, status: 'failed', error: friendlyMessagingError(data.error?.message ?? `Graph API returned ${res.status}`, platform) }
    }
    return { ok: true, status: 'sent' }
  }

  if (platform === 'x') {
    const token = await getValidToken('x')
    const res = await fetch(
      `https://api.twitter.com/2/dm_conversations/${conv.external_thread_id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: body }),
      }
    )
    const data = await res.json().catch(() => ({})) as { errors?: { message: string }[] }
    if (!res.ok || data.errors?.length) {
      return { ok: false, status: 'failed', error: data.errors?.[0]?.message ?? `X API returned ${res.status}` }
    }
    return { ok: true, status: 'sent' }
  }

  if (platform === 'gmail') {
    const token = await getValidToken('gmail')

    const threadRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/threads/${conv.external_thread_id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!threadRes.ok) {
      return { ok: false, status: 'failed', error: `Could not fetch Gmail thread: ${threadRes.status}` }
    }
    const thread = await threadRes.json() as {
      messages: Array<{ payload: { headers: Array<{ name: string; value: string }> } }>
    }

    const lastMsg = thread.messages?.[thread.messages.length - 1]
    const headers = lastMsg?.payload?.headers ?? []
    const msgId = headers.find((h) => h.name.toLowerCase() === 'message-id')?.value ?? ''
    const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''

    const raw = [
      `To: <${conv.contact_handle}>`,
      `Subject: Re: ${subject}`,
      msgId ? `In-Reply-To: ${msgId}` : '',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ]
      .filter((line) => line !== null)
      .join('\r\n')

    const encoded = Buffer.from(raw).toString('base64url')

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded, threadId: conv.external_thread_id }),
    })
    if (!sendRes.ok) {
      const errBody = await sendRes.text().catch(() => '')
      return { ok: false, status: 'failed', error: `Gmail send failed: ${sendRes.status} ${errBody}` }
    }
    return { ok: true, status: 'sent' }
  }

  if (platform === 'telegram') {
    const botToken = await getTelegramToken()
    if (!botToken) return { ok: false, status: 'failed', error: 'No Telegram connection found' }

    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: conv.external_thread_id, text: body }),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; description?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, status: 'failed', error: data.description ?? `Telegram API returned ${res.status}` }
    }
    return { ok: true, status: 'sent' }
  }

  // threads/tiktok: no DM send API exists (see CLAUDE.md) — app-side record only.
  return { ok: true, status: 'local_only' }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  let body: string
  try {
    const parsed = await request.json() as { body?: unknown }
    body = typeof parsed.body === 'string' ? parsed.body : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.trim()) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 })
  }

  // Scope to the owner in multi-user mode: a user must not be able to reply to
  // (and thereby send from) another tenant's conversation. No-op in the pilot.
  const userId = await scopedUserId()
  let convQ = adminSupabase.from('conversations').select('*').eq('id', id)
  if (userId) convQ = convQ.eq('user_id', userId)
  const { data: conv, error: convError } = await convQ.maybeSingle()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Insert the outbound row BEFORE sending. Zernio can fire the message.sent
  // echo back to our webhook before this route returns, and the webhook
  // reconciles the echo against this pending row (same thread + body, no
  // external id). If we inserted after sending, a fast echo would find no row
  // and insert a duplicate — which is what caused a quickly-sent second reply
  // to appear twice.
  const { data: msg, error } = await adminSupabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction: 'outbound',
      body,
      sent_at: new Date().toISOString(),
      send_status: 'sending',
      // Inherit the conversation's owner so the reply shows under per-user reads.
      ...(conv.user_id ? { user_id: conv.user_id } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Could not save reply' }, { status: 500 })

  let sendResult: SendResult
  try {
    sendResult = await sendReply(conv, body)
  } catch (sendErr) {
    console.error('Platform send error:', sendErr)
    sendResult = { ok: false, status: 'failed', error: sendErr instanceof Error ? sendErr.message : String(sendErr) }
  }

  // Record the final send outcome on the row we already created.
  await adminSupabase
    .from('messages')
    .update({ send_status: sendResult.status, send_error: sendResult.error ?? null })
    .eq('id', msg.id)
  const finalMsg = { ...msg, send_status: sendResult.status, send_error: sendResult.error ?? null }

  // Only mark the conversation "replied" if the message actually left the app
  // (or there's genuinely nowhere for it to go, e.g. Threads/TikTok).
  if (sendResult.ok) {
    await adminSupabase
      .from('conversations')
      .update({ status: 'replied', last_message_at: new Date().toISOString() })
      .eq('id', id)
  }

  if (!sendResult.ok) {
    return NextResponse.json(
      { ...finalMsg, error: sendResult.error ?? 'Reply was not sent' },
      { status: 502 }
    )
  }

  return NextResponse.json(finalMsg, { status: 201 })
}
