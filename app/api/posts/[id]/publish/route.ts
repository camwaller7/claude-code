import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  await inngest.send({
    name: 'post/publish.scheduled',
    data: { postId: id, scheduledAt: new Date().toISOString() },
  })

  return NextResponse.json({ queued: true })
}
