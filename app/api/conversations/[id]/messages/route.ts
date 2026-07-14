import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { triageMessage } from '@/lib/anthropic/triage'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const supabase = await createRouteHandlerSupabase()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const supabase = await createRouteHandlerSupabase()
  const body = await request.json()
  const { direction, body: messageBody } = body

  let ai_category = null
  let ai_draft_reply = null

  if (direction === 'inbound') {
    const { data: conv } = await supabase
      .from('conversations')
      .select('contact_name, platform')
      .eq('id', id)
      .single()

    if (conv) {
      const triage = await triageMessage(messageBody, conv.contact_name, conv.platform)
      ai_category = triage.category
      ai_draft_reply = triage.draftReply

      await supabase
        .from('conversations')
        .update({ category: triage.category, priority: triage.priority, last_message_at: new Date().toISOString() })
        .eq('id', id)
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction,
      body: messageBody,
      ai_category,
      ai_draft_reply,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
