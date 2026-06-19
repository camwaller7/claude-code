import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
import type { Platform } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

interface MessagingEvent {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message: { mid: string; text: string }
}

interface Entry {
  id: string
  messaging?: MessagingEvent[]
}

interface MetaWebhookPayload {
  object: string
  entry: Entry[]
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as MetaWebhookPayload
    const platform: Platform = payload.object === 'instagram' ? 'instagram' : 'facebook'

    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        // Skip messages we sent
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
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Meta webhook error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
