import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const userId = await scopedUserId()
  let q = adminSupabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: 'Could not load audit log' }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
