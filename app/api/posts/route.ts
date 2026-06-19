import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

export async function GET() {
  const supabase = await createRouteClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient()
  const body = await request.json()
  const { caption, hashtags, media_url, platforms, scheduled_at } = body

  const status = scheduled_at ? 'scheduled' : 'draft'

  const { data, error } = await supabase
    .from('posts')
    .insert({ caption, hashtags, media_url, platforms, scheduled_at, status })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (scheduled_at && data) {
    await inngest.send({
      name: 'post/publish.scheduled',
      data: { postId: data.id },
      ts: new Date(scheduled_at).getTime(),
    })
  }

  return NextResponse.json(data, { status: 201 })
}
