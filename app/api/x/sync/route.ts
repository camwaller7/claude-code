import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
import { getValidToken } from '@/lib/platform/tokens'

interface DmEvent {
  id: string
  text: string
  created_at: string
  sender_id: string
  dm_conversation_id: string
  event_type: string
}

interface DmEventsResponse {
  data?: DmEvent[]
}

export async function POST() {
  try {
    const token = await getValidToken('x')

    // Get our account_id
    const { data: conn } = await adminSupabase
      .from('platform_connections')
      .select('account_id')
      .eq('platform', 'x')
      .limit(1)
      .single()

    const ourAccountId = conn?.account_id ?? ''

    const res = await fetch(
      'https://api.twitter.com/2/dm_events?dm_event.fields=id,text,created_at,sender_id,dm_conversation_id&max_results=50',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const json = await res.json() as DmEventsResponse
    const events = json.data ?? []

    let synced = 0

    for (const event of events) {
      if (event.event_type !== 'MessageCreate') continue

      const direction = event.sender_id === ourAccountId ? 'outbound' : 'inbound'

      const { data: conv } = await adminSupabase
        .from('conversations')
        .upsert(
          {
            platform: 'x',
            external_thread_id: event.dm_conversation_id,
            contact_name: event.sender_id,
            contact_handle: event.sender_id,
            status: 'needs_reply',
            last_message_at: event.created_at,
          },
          { onConflict: 'platform,external_thread_id' }
        )
        .select()
        .single()

      if (!conv) continue

      await adminSupabase.from('messages').upsert({
        conversation_id: conv.id,
        direction,
        body: event.text,
        external_message_id: event.id,
        sent_at: event.created_at,
      }, { onConflict: 'external_message_id', ignoreDuplicates: true })

      if (direction === 'inbound') {
        const triage = await triageMessage(event.text, event.sender_id, 'x')
        await adminSupabase
          .from('conversations')
          .update({ category: triage.category, priority: triage.priority })
          .eq('id', conv.id)
      }

      synced++
    }

    return NextResponse.json({ synced })
  } catch (err) {
    console.error('X sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
