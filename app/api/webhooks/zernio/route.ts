import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import type { Platform } from '@/types'

// Zernio inbound webhook. Zernio POSTs unified inbox events here (configured via
// configureZernioWebhook). We handle `message.received` and ingest into the same
// conversations/messages tables the direct Meta webhook uses, so the Inbox UI is
// provider-agnostic. Unlike the raw Meta webhook, Zernio resolves the sender's
// name/username for us, so Facebook/Instagram contacts show a real name.

interface ZernioMessageEvent {
  id: string
  event: string
  message?: {
    id: string
    conversationId: string
    platform: string
    platformMessageId: string
    direction: 'incoming' | 'outgoing'
    text: string | null
    sender?: { id: string; name?: string; username?: string }
    attachments?: { type?: string; originalType?: string; url?: string; payload?: unknown }[]
  }
  // The connected account that received/sent this event. account.id is the
  // Zernio social account id — the key we route inbound events to the owning
  // app user by (see zernio_accounts).
  account?: { id: string; accountId?: string; platform?: string; username?: string }
}

// Resolve the app user that owns a Zernio account. Returns null when multi-user
// is off (single-tenant: rows carry no user_id) or the account isn't mapped yet.
async function resolveOwningUserId(accountId?: string): Promise<string | null> {
  if (!multiUserEnabled() || !accountId) return null
  const { data } = await adminSupabase
    .from('zernio_accounts')
    .select('user_id')
    .eq('zernio_account_id', accountId)
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

// Zernio signs webhook bodies with HMAC-SHA256 of the raw body keyed by the
// configured secret. The header name isn't pinned by the SDK types, so we check
// the common candidates. If the secret is set and a recognized signature header
// is present, we require it to match; if no known header is present we accept
// but log, to avoid dropping real events on a header-name mismatch (harden once
// the exact header is confirmed against Zernio's docs).
function verifyZernioSignature(rawBody: string, req: NextRequest): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) return true // no secret configured — nothing to verify against

  const candidates = ['x-zernio-signature', 'x-webhook-signature', 'x-signature']
  const header = candidates.map((h) => req.headers.get(h)).find(Boolean)
  if (!header) {
    console.warn('[zernio-webhook] no signature header found; accepting unverified')
    return true
  }

  const received = header.startsWith('sha256=') ? header.slice('sha256='.length) : header
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== received.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifyZernioSignature(rawBody, request)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: ZernioMessageEvent
  try {
    payload = JSON.parse(rawBody) as ZernioMessageEvent
  } catch {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  // Ingest inbound messages (message.received) and the creator's own outbound
  // replies (message.sent) — the latter captures replies sent from the native
  // app (e.g. Instagram on the phone) so the app shows the full conversation.
  const msg = payload.message
  const isIncoming = payload.event === 'message.received' && msg?.direction === 'incoming'
  const isOutgoing = payload.event === 'message.sent'
  if (!msg || (!isIncoming && !isOutgoing)) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const platform = msg.platform as Platform
    const text = msg.text ?? ''
    const now = new Date().toISOString()

    // Multi-user routing: attribute this event to the app user that owns the
    // receiving Zernio account. Null (and omitted from writes) in single-tenant
    // mode, or before migration 021 adds the user_id column — so this stays safe
    // to deploy ahead of the migration.
    const userId = await resolveOwningUserId(payload.account?.id ?? payload.account?.accountId)
    const owner = userId ? { user_id: userId } : {}

    // Normalise attachments (images/videos/voice notes/shared posts) for storage
    // so the thread can render them. Only set the column when there are any, so
    // the write stays safe before migration 025 adds the column.
    const attachments = (msg.attachments ?? [])
      .map(a => ({ type: (a.type ?? a.originalType ?? 'file'), url: a.url }))
      .filter(a => a.url)
    const media = attachments.length ? { attachments } : {}
    if (multiUserEnabled() && !userId) {
      console.warn('[zernio-webhook] no app user mapped for account', payload.account?.id, '— ingesting unattributed')
    }

    if (isOutgoing) {
      // On message.sent the "sender" is our own business account, NOT the
      // contact — do not touch contact_name/handle. Only update an EXISTING
      // conversation (a thread always begins with an inbound message), record
      // the outbound message, and mark it replied. No triage on our own sends.
      const { data: conv } = await adminSupabase
        .from('conversations')
        .select('id')
        .eq('platform', platform)
        .eq('external_thread_id', msg.conversationId)
        .maybeSingle()

      if (!conv) return NextResponse.json({ received: true }, { status: 200 })

      const extId = msg.platformMessageId || msg.id

      // Reconcile the echo with a reply just sent from the app: the reply route
      // inserts the outbound message with no external id, then Zernio echoes it
      // back here. Match that pending row (same thread + body, no external id,
      // sent in the last few minutes) and attach the external id to it instead
      // of inserting a second copy — this is what caused replies to appear
      // twice. Fall back to inserting when there's no pending row (e.g. a reply
      // the creator sent from the native app).
      const { data: pending } = await adminSupabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conv.id)
        .eq('direction', 'outbound')
        .eq('body', text)
        .is('external_message_id', null)
        .gte('sent_at', new Date(Date.now() - 5 * 60_000).toISOString())
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pending) {
        await adminSupabase
          .from('messages')
          .update({ external_message_id: extId })
          .eq('id', pending.id)
      } else {
        await adminSupabase.from('messages').upsert(
          {
            conversation_id: conv.id,
            direction: 'outbound',
            body: text,
            external_message_id: extId,
            sent_at: now,
            ...owner,
            ...media,
          },
          { onConflict: 'external_message_id', ignoreDuplicates: true }
        )
      }

      await adminSupabase
        .from('conversations')
        .update({ status: 'replied', last_message_at: now })
        .eq('id', conv.id)

      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Inbound (message.received): the sender is the contact.
    const sender = msg.sender
    const name = sender?.name || sender?.username || sender?.id || 'Unknown'
    const handle = sender?.username ? `@${sender.username}` : sender?.id ?? ''

    // external_thread_id is Zernio's conversationId so replies can be sent back
    // via POST /v1/inbox/conversations/{conversationId}/messages.
    const { data: conv } = await adminSupabase
      .from('conversations')
      .upsert(
        {
          platform,
          external_thread_id: msg.conversationId,
          contact_name: name,
          contact_handle: handle,
          status: 'needs_reply',
          last_message_at: now,
          ...owner,
        },
        { onConflict: 'platform,external_thread_id' }
      )
      .select()
      .single()

    if (!conv) return NextResponse.json({ received: true }, { status: 200 })

    await adminSupabase.from('messages').upsert(
      {
        conversation_id: conv.id,
        direction: 'inbound',
        body: text,
        external_message_id: msg.platformMessageId || msg.id,
        sent_at: now,
        ...owner,
        ...media,
      },
      { onConflict: 'external_message_id', ignoreDuplicates: true }
    )

    if (text) {
      const triage = await triageMessage(text, name, platform, userId)
      await adminSupabase
        .from('conversations')
        .update({ category: triage.category, priority: triage.priority })
        .eq('id', conv.id)
    }
  } catch (err) {
    console.error('[zernio-webhook] ingest error:', err)
    // Still 200 so Zernio doesn't disable the webhook; we've logged it.
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
