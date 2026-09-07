import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import type { MessageCategory, MessageStatus } from '@/types'

const CATEGORIES: MessageCategory[] = ['brand_deal', 'client', 'fan', 'personal', 'spam', 'uncategorized']
const STATUSES: MessageStatus[] = ['needs_reply', 'replied', 'archived']

// Update a conversation's category (manual categorisation from the inbox list)
// or status.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { category?: string; status?: string }

  const update: Record<string, string> = {}
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category as MessageCategory)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    update.category = body.category
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as MessageStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    update.status = body.status
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // Scope to the owner in multi-user mode so a user can't mutate another
  // tenant's conversation (the admin client bypasses RLS). No-op in the pilot.
  const userId = await scopedUserId()
  let q = adminSupabase.from('conversations').update(update).eq('id', id)
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q.select().maybeSingle()

  if (error) return NextResponse.json({ error: 'Could not update conversation' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// Delete a conversation from Corvelle. messages cascade-delete; deals/clients
// linked to it have their conversation_id set null (per the schema FKs). This
// only removes the record from the app — it does not delete anything on the
// original platform.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const userId = await scopedUserId()
  let q = adminSupabase.from('conversations').delete().eq('id', id)
  if (userId) q = q.eq('user_id', userId)
  const { error } = await q

  if (error) return NextResponse.json({ error: 'Could not delete conversation' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
