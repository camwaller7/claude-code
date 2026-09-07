import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const userId = await scopedUserId()
  let query = supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: false })
  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const userId = await scopedUserId()

  let body: { caption?: string; hashtags?: string; platforms?: string[]; media_url?: string; scheduled_at?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { caption, hashtags, platforms, media_url, scheduled_at } = body

  if (!caption?.trim()) {
    return NextResponse.json({ error: 'Caption is required' }, { status: 400 })
  }

  const status = scheduled_at ? 'scheduled' : 'draft'

  const { data, error } = await supabase
    .from('posts')
    .insert({ caption, hashtags: hashtags ?? '', platforms: platforms ?? [], media_url: media_url ?? null, scheduled_at: scheduled_at ?? null, status, ...(userId ? { user_id: userId } : {}) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (scheduled_at && data) {
    // Never let a broken/unconfigured Inngest connection fail the save —
    // the post is already in the DB and correctly marked "scheduled";
    // the background publish step is best-effort on top of that.
    try {
      await inngest.send({
        name: 'post/publish.scheduled',
        data: { postId: data.id, scheduledAt: scheduled_at },
      })
    } catch (e) {
      console.error('[posts] inngest.send failed — post saved but auto-publish event not queued:', e)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
