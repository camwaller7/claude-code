import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function GET() {
  const supabase = await createRouteHandlerSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerSupabase()
  const body = await request.json()
  const { caption, hashtags, platforms, media_url, scheduled_at } = body

  const status = scheduled_at ? 'scheduled' : 'draft'

  const { data, error } = await supabase
    .from('posts')
    .insert({ caption, hashtags: hashtags ?? '', platforms: platforms ?? [], media_url: media_url ?? null, scheduled_at: scheduled_at ?? null, status })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (scheduled_at && data) {
    await inngest.send({
      name: 'post/publish.scheduled',
      data: { postId: data.id, scheduledAt: scheduled_at },
    })
  }

  return NextResponse.json(data, { status: 201 })
}
