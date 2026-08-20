import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
import { getValidMetaToken } from '@/lib/platform/tokens'
import { decryptToken } from '@/lib/crypto/tokenCipher'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'
import { metaDebug } from '@/lib/log/debug'
import { appsecretProof } from '@/lib/platform/appsecretProof'
import type { Platform } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''
  const tokenMatches = Boolean(token) && Boolean(expectedToken) &&
    token!.length === expectedToken.length &&
    timingSafeEqual(Buffer.from(token!), Buffer.from(expectedToken))

  if (mode === 'subscribe' && tokenMatches) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

interface MessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: { mid: string; text?: string; is_echo?: boolean }
}

// Instagram Business Login delivers DMs under entry.changes[] with
// field "messages", NOT under entry.messaging[] like Facebook Pages do.
interface ChangeValue {
  sender?: { id: string }
  recipient?: { id: string }
  timestamp?: number
  message?: { mid?: string; text?: string; is_echo?: boolean }
}

interface Change {
  field?: string
  value?: ChangeValue
}

interface Entry {
  id: string
  messaging?: MessagingEvent[]
  changes?: Change[]
}

interface MetaWebhookPayload {
  object: string
  entry: Entry[]
}

function matchesSecret(rawBody: string, received: string, secret: string | undefined): boolean {
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== received.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const received = signatureHeader.slice('sha256='.length)
  // Facebook Page events are signed with the Meta app secret; Instagram
  // Login events are signed with the Instagram app secret. Accept either.
  return (
    matchesSecret(rawBody, received, process.env.META_APP_SECRET) ||
    matchesSecret(rawBody, received, process.env.INSTAGRAM_APP_SECRET)
  )
}

// Facebook's User Profile API (GET /{PSID}) can return an empty or gated result
// for a page-scoped id even when messaging works. The Conversations API exposes
// the participant's display name and is available with pages_messaging, so it's
// a reliable fallback for turning a PSID into a real name.
async function facebookParticipantName(
  pageId: string,
  psid: string,
  token: string,
  proofQuery: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/conversations?platform=messenger&user_id=${psid}&fields=participants&access_token=${encodeURIComponent(token)}${proofQuery}`
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { participants?: { data?: { id: string; name?: string }[] } }[]
    }
    for (const conv of json.data ?? []) {
      for (const p of conv.participants?.data ?? []) {
        if (p.id !== pageId && p.name) return p.name
      }
    }
    return null
  } catch {
    return null
  }
}

// The webhook payload only carries the sender's numeric ID (PSID/IGSID), not a
// display name — so without this the inbox shows a raw number as the contact.
// Resolve a human-readable name/handle via the Graph API using the connected
// Page/IG token. Falls back to the raw ID on any failure so ingestion never
// breaks and the NOT NULL contact_name/contact_handle columns stay satisfied.
async function resolveMetaContact(
  platform: Platform,
  pageId: string,
  senderId: string
): Promise<{ name: string; handle: string }> {
  const fallback = { name: senderId, handle: senderId }
  if (platform !== 'facebook' && platform !== 'instagram') return fallback

  try {
    // Prefer the connection whose account_id matches the Page/IG account that
    // received the message; fall back to any connection for this platform.
    let { data: conn } = await adminSupabase
      .from('platform_connections')
      .select('access_token, account_id')
      .eq('platform', platform)
      .eq('account_id', pageId)
      .maybeSingle()

    if (!conn) {
      const anyConn = await adminSupabase
        .from('platform_connections')
        .select('access_token, account_id')
        .eq('platform', platform)
        .limit(1)
        .maybeSingle()
      conn = anyConn.data
    }
    if (!conn) return fallback

    let token: string | null
    try {
      token = await getValidMetaToken(platform, conn.account_id)
    } catch {
      token = decryptToken(conn.access_token)
    }
    if (!token) return fallback

    // Facebook messaging users (PSIDs) expose first_name/last_name, not a
    // single `name` field; Instagram messaging users (IGSIDs) expose
    // name/username. Request the right fields per platform.
    const fields = platform === 'instagram' ? 'name,username' : 'first_name,last_name'
    const proof = appsecretProof(token, platform)
    const proofQuery = proof ? `&appsecret_proof=${proof}` : ''
    // Instagram Login tokens only resolve against graph.instagram.com; Facebook
    // Page tokens against graph.facebook.com. Using the wrong host returns an
    // error and the inbox falls back to the raw numeric ID.
    const host = platform === 'instagram' ? 'https://graph.instagram.com' : 'https://graph.facebook.com'
    const res = await fetch(
      `${host}/${META_GRAPH_VERSION}/${senderId}?fields=${fields}&access_token=${encodeURIComponent(token)}${proofQuery}`
    )
    const rawBody = await res.text()
    // TEMPORARY DIAGNOSTIC — reveal whether the profile lookup returns a name
    // or is being gated/emptied (which would keep the inbox showing the ID).
    metaDebug('[meta-webhook-debug] contact lookup', platform, senderId, '| status', res.status, '| body', rawBody)
    const data = (() => {
      try {
        return JSON.parse(rawBody) as {
          name?: string
          username?: string
          first_name?: string
          last_name?: string
          error?: { message: string }
        }
      } catch {
        return {} as Record<string, never>
      }
    })()
    const errored = 'error' in data && Boolean(data.error)
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
    let name = errored ? '' : data.name || fullName || data.username || ''
    const handle = !errored && data.username ? `@${data.username}` : senderId

    // If the profile lookup gave us no usable name (gated, empty, or errored),
    // fall back to the Conversations API participant name for Facebook.
    if (!name && platform === 'facebook') {
      const convName = await facebookParticipantName(pageId, senderId, token, proofQuery)
      if (convName) name = convName
    }

    return { name: name || senderId, handle }
  } catch {
    return fallback
  }
}

// Shared ingest: upsert the conversation, insert the inbound message, triage.
// Used by both the Facebook messaging[] path and the Instagram changes[] path.
async function ingestInboundMessage(
  platform: Platform,
  entryId: string,
  senderId: string,
  timestampMs: number,
  text: string
): Promise<void> {
  const contact = await resolveMetaContact(platform, entryId, senderId)
  const { data: conv } = await adminSupabase
    .from('conversations')
    .upsert(
      {
        platform,
        external_thread_id: senderId,
        contact_name: contact.name,
        contact_handle: contact.handle,
        status: 'needs_reply',
        last_message_at: new Date(timestampMs).toISOString(),
      },
      { onConflict: 'platform,external_thread_id' }
    )
    .select()
    .single()

  if (!conv) return

  await adminSupabase.from('messages').insert({
    conversation_id: conv.id,
    direction: 'inbound',
    body: text,
    sent_at: new Date(timestampMs).toISOString(),
  })

  const triage = await triageMessage(text, senderId, platform)
  await adminSupabase
    .from('conversations')
    .update({ category: triage.category, priority: triage.priority })
    .eq('id', conv.id)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // TEMPORARY DIAGNOSTIC — remove once inbox sync is confirmed working.
  // Logs the exact payload Meta delivers so we can see whether real inbound
  // messages arrive under entry.messaging[] (as this code expects) or under
  // entry.changes[] / some other shape (which would be silently ignored).
  metaDebug('[meta-webhook-debug] raw payload:', rawBody)

  try {
    const payload = JSON.parse(rawBody) as MetaWebhookPayload
    const platform: Platform = payload.object === 'instagram' ? 'instagram' : 'facebook'

    metaDebug('[meta-webhook-debug] object:', payload.object, '| entries:', (payload.entry ?? []).length)
    for (const entry of payload.entry ?? []) {
      console.log(
        '[meta-webhook-debug] entry.id:', entry.id,
        '| has messaging:', Array.isArray(entry.messaging), '(', entry.messaging?.length ?? 0, ')',
        '| has changes:', Array.isArray(entry.changes), '(', entry.changes?.length ?? 0, ')'
      )
      // Facebook Pages path: inbound events arrive under entry.messaging[].
      for (const event of entry.messaging ?? []) {
        try {
          // Only handle real inbound text messages — skip echoes, read
          // receipts, delivery confirmations, postbacks, attachments-only
          if (!event.message?.text || event.message.is_echo) {
            metaDebug('[meta-webhook-debug] skipped event — no text or is_echo. keys:', JSON.stringify(Object.keys(event)), '| message:', JSON.stringify(event.message ?? null))
            continue
          }
          if (event.sender.id === entry.id) {
            metaDebug('[meta-webhook-debug] skipped event — sender.id === entry.id (self/outbound echo)')
            continue
          }
          metaDebug('[meta-webhook-debug] ACCEPTED inbound message from', event.sender.id)
          await ingestInboundMessage(platform, entry.id, event.sender.id, event.timestamp, event.message.text)
        } catch (eventErr) {
          // One bad event must not fail the whole batch — Meta retries and
          // eventually disables webhooks that keep returning errors
          console.error('Meta webhook event error:', eventErr)
        }
      }

      // Instagram Business Login path: inbound DMs arrive under entry.changes[]
      // with field "messages" (NOT under messaging[]). This is why IG DMs never
      // loaded before — the events were logged and dropped.
      for (const change of entry.changes ?? []) {
        try {
          if (change.field !== 'messages' || !change.value) {
            metaDebug('[meta-webhook-debug] skipped change — field:', change.field, '| value:', JSON.stringify(change.value ?? null))
            continue
          }
          const value = change.value
          if (!value.message?.text || value.message.is_echo) {
            metaDebug('[meta-webhook-debug] skipped change — no text or is_echo. value:', JSON.stringify(value))
            continue
          }
          if (!value.sender?.id || value.sender.id === entry.id) {
            metaDebug('[meta-webhook-debug] skipped change — missing sender or self/outbound echo')
            continue
          }
          metaDebug('[meta-webhook-debug] ACCEPTED inbound change message from', value.sender.id)
          await ingestInboundMessage(
            platform,
            entry.id,
            value.sender.id,
            value.timestamp ?? Date.now(),
            value.message.text
          )
        } catch (changeErr) {
          console.error('Meta webhook change error:', changeErr)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Meta webhook error:', err)
    // Still return 200 so Meta doesn't disable the subscription
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
