import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit/log'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { encryptToken } from '@/lib/crypto/tokenCipher'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('gmail_oauth_state')?.value

  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  cookieStore.delete('gmail_oauth_state')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`,
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

  // Get user email
  const userRes = await fetch(
    `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenData.access_token}`
  )
  const userData = await userRes.json() as {
    email: string
    error?: { message: string }
  }

  if (userData.error) {
    return NextResponse.json({ error: userData.error.message }, { status: 400 })
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  await adminSupabase.from('platform_connections').upsert(
    {
      platform: 'gmail',
      account_id: userData.email,
      access_token: encryptToken(tokenData.access_token),
      refresh_token: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'platform,account_id' }
  )

  await auditLog('platform_connected', { platform: 'gmail' })

  return NextResponse.redirect(new URL('/onboarding?connected=gmail', request.url))
}
