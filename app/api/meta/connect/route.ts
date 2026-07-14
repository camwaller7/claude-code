import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('meta_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`,
    scope: 'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_posts',
    response_type: 'code',
    state,
  })

  const url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  return NextResponse.redirect(url)
}
