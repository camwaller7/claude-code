import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
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
  }
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

  // Only ingest inbound messages; ignore echoes of our own sends and other events.
  const msg = payload.message
  if (payload.event !== 'message.received' || !msg || msg.direction !== 'incoming') {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    const platform = msg.platform as Platform
    const sender = msg.sender
    const name = sender?.name || sender?.username || sender?.id || 'Unknown'
    const handle = sender?.username ? `@${sender.username}` : sender?.id ?? ''
    const text = msg.text ?? ''

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
          last_message_at: new Date().toISOString(),
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
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'external_message_id', ignoreDuplicates: true }
    )

    if (text) {
      const triage = await triageMessage(text, name, platform)
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
