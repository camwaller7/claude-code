import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createRouteHandlerSupabase()
  const body = await request.json()
  const { status, deal_value, notes, agreed_date, payment_due_date, contact_name } = body

  const update: Record<string, unknown> = {}
  if (status !== undefined) update.status = status
  if (deal_value !== undefined) update.deal_value = deal_value
  if (notes !== undefined) update.notes = notes
  if (agreed_date !== undefined) update.agreed_date = agreed_date
  if (payment_due_date !== undefined) update.payment_due_date = payment_due_date
  if (contact_name !== undefined) update.contact_name = contact_name

  const { data, error } = await supabase
    .from('deals')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createRouteHandlerSupabase()
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
