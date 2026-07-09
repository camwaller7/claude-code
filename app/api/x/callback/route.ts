import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('x_oauth_state')?.value
  const codeVerifier = cookieStore.get('x_code_verifier')?.value

  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  cookieStore.delete('x_oauth_state')
  cookieStore.delete('x_code_verifier')

  if (!code || !codeVerifier) {
    return NextResponse.json({ error: 'Missing code or verifier' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/x/callback`
  const clientId = process.env.X_CLIENT_ID!
  const clientSecret = process.env.X_CLIENT_SECRET!

  // Exchange code for token using Basic auth
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: clientId,
    }),
  })
  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error_description ?? tokenData.error }, { status: 400 })
  }

  // Get user info
  const meRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const meData = await meRes.json() as {
    data: { id: string; name: string; username: string }
    errors?: Array<{ message: string }>
  }

  if (meData.errors?.length) {
    return NextResponse.json({ error: meData.errors[0].message }, { status: 400 })
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  await adminSupabase.from('platform_connections').upsert(
    {
      platform: 'x',
      account_id: meData.data.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'platform,account_id' }
  )

  return NextResponse.redirect(new URL('/onboarding?connected=x', request.url))
}
