import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getValidToken, getValidMetaToken } from '@/lib/platform/tokens'
import { decryptToken } from '@/lib/crypto/tokenCipher'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'

const META_MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

interface SendResult {
  ok: boolean
  status: 'sent' | 'failed' | 'local_only'
  error?: string
}

async function sendReply(conv: Record<string, unknown>, body: string): Promise<SendResult> {
  const platform = conv.platform as string

  if (platform === 'instagram' || platform === 'facebook') {
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

    let token: string
    try {
      token = await getValidMetaToken(platform as 'facebook' | 'instagram', conn.account_id as string)
    } catch {
      token = decryptToken(conn.access_token as string)!
    }

    // Post to the specific Page/IG account id rather than `/me`. With a Page
    // token `/me` resolves to the Page, but if the wrong token is stored `/me`
    // fails with a confusing "object 'me' does not exist" error — addressing
    // the account explicitly is unambiguous and works for both platforms.
    // The Messenger Send API requires messaging_type; omitting it triggers a
    // generic "An unknown error has occurred" (OAuthException code 1).
    // RESPONSE is correct for a normal reply inside the 24-hour window (which
    // we've already enforced above). Instagram's send API doesn't use it.
    const sendPayload: Record<string, unknown> = {
      recipient: { id: conv.external_thread_id },
      message: { text: body },
    }
    if (platform === 'facebook') {
      sendPayload.messaging_type = 'RESPONSE'
    }

    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${conn.account_id}/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendPayload),
      }
    )
    // TEMPORARY DIAGNOSTIC — read the full raw body; the generic code 1 error
    // hides its real cause in error_data/error_user_msg, which JSON-picking
    // `error` alone drops. Log the whole request context + raw response.
    const rawResponse = await res.text()
    let data: {
      error?: { message: string; code?: number; error_subcode?: number; fbtrace_id?: string }
    } = {}
    try {
      data = JSON.parse(rawResponse)
    } catch {
      /* non-JSON body — rawResponse logged below */
    }
    if (!res.ok || data.error) {
      console.error(
        '[reply-debug] Meta send failed. status:', res.status,
        '| version:', META_GRAPH_VERSION,
        '| endpoint:', `${conn.account_id}/messages`,
        '| payload:', JSON.stringify(sendPayload),
        '| raw:', rawResponse
      )
      return { ok: false, status: 'failed', error: data.error?.message ?? `Graph API returned ${res.status}` }
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
  const { body } = await request.json() as { body: string }

  const { data: conv, error: convError } = await adminSupabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  let sendResult: SendResult
  try {
    sendResult = await sendReply(conv, body)
  } catch (sendErr) {
    console.error('Platform send error:', sendErr)
    sendResult = { ok: false, status: 'failed', error: sendErr instanceof Error ? sendErr.message : String(sendErr) }
  }

  const { data: msg, error } = await adminSupabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction: 'outbound',
      body,
      sent_at: new Date().toISOString(),
      send_status: sendResult.status,
      send_error: sendResult.error ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
      { ...msg, error: sendResult.error ?? 'Reply was not sent' },
      { status: 502 }
    )
  }

  return NextResponse.json(msg, { status: 201 })
}
