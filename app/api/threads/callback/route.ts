import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit/log'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getCurrentUserId } from '@/lib/auth/currentUser'
import { encryptToken } from '@/lib/crypto/tokenCipher'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('threads_oauth_state')?.value

  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  cookieStore.delete('threads_oauth_state')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/threads/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json() as {
    access_token: string
    user_id: string
    error?: { message: string }
  }

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error.message }, { status: 400 })
  }

  // Exchange for long-lived token
  const longLivedParams = new URLSearchParams({
    grant_type: 'th_exchange_token',
    client_secret: process.env.THREADS_APP_SECRET!,
    access_token: tokenData.access_token,
  })
  const longLivedRes = await fetch(
    `https://graph.threads.net/access_token?${longLivedParams.toString()}`
  )
  const longLivedData = await longLivedRes.json() as {
    access_token: string
    expires_in?: number
    error?: { message: string }
  }

  if (longLivedData.error) {
    return NextResponse.json({ error: longLivedData.error.message }, { status: 400 })
  }

  const expiresAt = longLivedData.expires_in
    ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
    : null

  const ownerId = await getCurrentUserId()
  await adminSupabase.from('platform_connections').upsert(
    {
      platform: 'threads',
      account_id: String(tokenData.user_id),
      access_token: encryptToken(longLivedData.access_token),
      refresh_token: null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      ...(ownerId ? { user_id: ownerId } : {}),
    },
    { onConflict: 'platform,account_id' }
  )

  await auditLog('platform_connected', { platform: 'threads' })

  return NextResponse.redirect(new URL('/onboarding?connected=threads', request.url))
}
