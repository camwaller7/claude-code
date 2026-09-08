import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { postPortalEnabled } from '@/lib/flags'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized
  if (!postPortalEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  const supabase = await createRouteHandlerSupabase()

  const { data: post, error } = await supabase
    .from('posts')
    .select('id, status')
    .eq('id', id)
    .single()

  if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.status === 'publishing' || post.status === 'published') {
    return NextResponse.json({ error: `Post is already ${post.status}` }, { status: 409 })
  }

  try {
    await inngest.send({
      name: 'post/publish.scheduled',
      data: { postId: id, scheduledAt: new Date().toISOString() },
    })
  } catch (e) {
    console.error('[posts/publish] inngest.send failed:', e)
    return NextResponse.json({ error: 'Could not queue publish job' }, { status: 502 })
  }

  return NextResponse.json({ queued: true })
}
