import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage, importantFromTriage } from '@/lib/anthropic/triage'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { conflictTarget } from '@/lib/db/conflictTargets'
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

// Verify the Zernio webhook signature (audit C5 — now fails CLOSED).
// Zernio signs the raw body with HMAC-SHA256 keyed by ZERNIO_WEBHOOK_SECRET, but
// its SDK doesn't pin the HTTP header NAME. Rather than guess the name (and risk
// dropping real events, or accepting forgeries), we compute the expected HMAC
// and check it against EVERY incoming header value — hex and base64, with an
// optional `sha256=` prefix, timing-safe. A request is accepted only if some
// header carries the correct signature. Fails closed: no secret, or no matching
// header ⇒ reject. `ZERNIO_WEBHOOK_SIGNATURE_HEADER` can pin the exact header if
// ever needed, but is not required.
function timingSafeStrEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function verifyZernioSignature(rawBody: string, req: NextRequest): boolean {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[zernio-webhook] ZERNIO_WEBHOOK_SECRET is not set — rejecting.')
    return false
  }

  const mac = createHmac('sha256', secret).update(rawBody)
  const expectedHex = mac.digest('hex')
  const expectedB64 = createHmac('sha256', secret).update(rawBody).digest('base64')

  // If a specific header is configured, check only that one; else scan all.
  const pinned = process.env.ZERNIO_WEBHOOK_SIGNATURE_HEADER
  const values: string[] = []
  if (pinned) {
    const v = req.headers.get(pinned)
    if (v) values.push(v)
  } else {
    req.headers.forEach((v) => values.push(v))
  }

  for (const raw of values) {
    const v = raw.startsWith('sha256=') ? raw.slice('sha256='.length) : raw
    if (timingSafeStrEqual(v, expectedHex) || timingSafeStrEqual(v, expectedB64)) {
      return true
    }
  }
  console.error('[zernio-webhook] no valid signature on request — rejecting.')
  return false
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
          { onConflict: conflictTarget.message(), ignoreDuplicates: true }
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
        { onConflict: conflictTarget.conversation() }
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
      { onConflict: conflictTarget.message(), ignoreDuplicates: true }
    )

    if (text) {
      const triage = await triageMessage(text, name, platform, userId)
      await adminSupabase
        .from('conversations')
        .update({
          category: triage.category,
          priority: triage.priority,
          // Auto-star real business / urgent DMs; never auto-unstar.
          ...(importantFromTriage(triage) ? { is_important: true } : {}),
        })
        .eq('id', conv.id)
    }
  } catch (err) {
    console.error('[zernio-webhook] ingest error:', err)
    // Still 200 so Zernio doesn't disable the webhook; we've logged it.
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
