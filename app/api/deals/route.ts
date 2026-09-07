import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const userId = await scopedUserId()
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase.from('deals').select('*').order('created_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const userId = await scopedUserId()
  const body = await request.json()
  const { brand_name, contact_name, deal_value, currency, conversation_id } = body

  const { data, error } = await supabase
    .from('deals')
    .insert({ brand_name, contact_name, deal_value, currency: currency ?? 'USD', conversation_id: conversation_id ?? null, ...(userId ? { user_id: userId } : {}) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
