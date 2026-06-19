import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createRouteClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase.from('deals').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient()
  const body = await request.json()
  const { brand_name, contact_name, deal_value, currency, conversation_id } = body

  const { data, error } = await supabase
    .from('deals')
    .insert({ brand_name, contact_name, deal_value, currency: currency ?? 'USD', conversation_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
