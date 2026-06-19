import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createRouteHandlerSupabase()
  const { body } = await request.json()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction: 'outbound',
      body,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('conversations')
    .update({ status: 'replied', last_message_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json(data, { status: 201 })
}
