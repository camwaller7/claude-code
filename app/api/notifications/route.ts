import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { adminSupabase } from '@/lib/supabase/admin'

// Stored event notifications (e.g. "your post is live"). Read via the admin
// client scoped to the signed-in user, matching how the rest of the app reads
// in both single- and multi-tenant modes.

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const uid = await scopedUserId()
    let query = adminSupabase
      .from('notifications')
      .select('id, type, title, body, href, meta, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    if (uid) query = query.eq('user_id', uid)
    const { data } = await query
    return NextResponse.json({ notifications: data ?? [] })
  } catch (e) {
    console.error('[notifications] list', e)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

// Mark notifications read. Body: { id } for one, or {} / { all: true } for all.
export async function PATCH(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const uid = await scopedUserId()
    const body = (await request.json().catch(() => ({}))) as { id?: string }
    let query = adminSupabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (uid) query = query.eq('user_id', uid)
    if (body.id) query = query.eq('id', body.id)
    await query
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notifications] mark read', e)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
