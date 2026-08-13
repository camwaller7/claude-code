import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('instagram_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`,
    scope: 'instagram_business_basic,instagram_business_manage_messages',
    response_type: 'code',
    state,
  })

  const url = `https://www.instagram.com/oauth/authorize?${params.toString()}`
  return NextResponse.redirect(url)
}
