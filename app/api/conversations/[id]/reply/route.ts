import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createRouteClient()
  const body = await request.json()
  const { body: replyBody } = body

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction: 'outbound',
      body: replyBody,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('conversations')
    .update({ status: 'replied', last_message_at: new Date().toISOString() })
    .eq('id', id)

  // Platform-specific send calls will be added per integration
  return NextResponse.json(message, { status: 201 })
}
