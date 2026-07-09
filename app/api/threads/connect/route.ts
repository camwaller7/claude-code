import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('threads_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/threads/callback`,
    scope: 'threads_basic,threads_content_publish',
    response_type: 'code',
    state,
  })

  const url = `https://threads.net/oauth/authorize?${params.toString()}`
  return NextResponse.redirect(url)
}
