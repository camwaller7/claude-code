import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
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

interface Entry {
  id: string
  messaging?: MessagingEvent[]
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody) as MetaWebhookPayload
    const platform: Platform = payload.object === 'instagram' ? 'instagram' : 'facebook'

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        try {
          // Only handle real inbound text messages — skip echoes, read
          // receipts, delivery confirmations, postbacks, attachments-only
          if (!event.message?.text || event.message.is_echo) continue
          if (event.sender.id === entry.id) continue

          const { data: conv } = await adminSupabase
            .from('conversations')
            .upsert(
              {
                platform,
                external_thread_id: event.sender.id,
                contact_name: event.sender.id,
                contact_handle: event.sender.id,
                status: 'needs_reply',
                last_message_at: new Date(event.timestamp).toISOString(),
              },
              { onConflict: 'platform,external_thread_id' }
            )
            .select()
            .single()

          if (!conv) continue

          await adminSupabase.from('messages').insert({
            conversation_id: conv.id,
            direction: 'inbound',
            body: event.message.text,
            sent_at: new Date(event.timestamp).toISOString(),
          })

          const triage = await triageMessage(event.message.text, event.sender.id, platform)
          await adminSupabase
            .from('conversations')
            .update({ category: triage.category, priority: triage.priority })
            .eq('id', conv.id)
        } catch (eventErr) {
          // One bad event must not fail the whole batch — Meta retries and
          // eventually disables webhooks that keep returning errors
          console.error('Meta webhook event error:', eventErr)
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
