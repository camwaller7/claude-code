import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const userId = await scopedUserId()
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)

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
  const { platform, external_thread_id, contact_name, contact_handle } = body

  const { data, error } = await supabase
    .from('conversations')
    .insert({ platform, external_thread_id, contact_name, contact_handle, ...(userId ? { user_id: userId } : {}) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
