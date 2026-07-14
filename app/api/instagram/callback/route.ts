import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit/log'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('instagram_oauth_state')?.value

  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  cookieStore.delete('instagram_oauth_state')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  })
  const tokenData = await tokenRes.json() as {
    access_token: string
    user_id?: string
    error_message?: string
  }

  if (!tokenRes.ok || tokenData.error_message) {
    return NextResponse.json({ error: tokenData.error_message ?? 'Token exchange failed' }, { status: 400 })
  }

  // Exchange for long-lived token
  const longLivedParams = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    access_token: tokenData.access_token,
  })
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?${longLivedParams.toString()}`
  )
  const longLivedData = await longLivedRes.json() as {
    access_token: string
    expires_in?: number
    error_message?: string
  }

  if (!longLivedRes.ok || longLivedData.error_message) {
    return NextResponse.json({ error: longLivedData.error_message ?? 'Long-lived token exchange failed' }, { status: 400 })
  }

  const accessToken = longLivedData.access_token
  const expiresAt = longLivedData.expires_in
    ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
    : null

  // Get the connected Instagram business account's id/username
  const meRes = await fetch(
    `https://graph.instagram.com/me?fields=user_id,username&access_token=${accessToken}`
  )
  const meData = await meRes.json() as {
    user_id: string
    username: string
    error_message?: string
  }

  if (!meRes.ok || meData.error_message) {
    return NextResponse.json({ error: meData.error_message ?? 'Failed to fetch Instagram account' }, { status: 400 })
  }

  await adminSupabase.from('platform_connections').upsert(
    {
      platform: 'instagram',
      account_id: meData.user_id,
      access_token: accessToken,
      refresh_token: null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'platform,account_id' }
  )

  // Without this, Meta never sends DM/comment events to our webhook — the
  // account has to explicitly subscribe the app to receive them.
  const subscribeRes = await fetch(
    `https://graph.instagram.com/v21.0/${meData.user_id}/subscribed_apps?subscribed_fields=messages,comments&access_token=${accessToken}`,
    { method: 'POST' }
  )
  const subscribeData = await subscribeRes.json().catch(() => ({})) as { success?: boolean; error?: { message: string } }
  if (!subscribeRes.ok || subscribeData.error) {
    console.error('[instagram/callback] webhook subscription failed:', subscribeData.error?.message)
  }

  await auditLog('platform_connected', { platform: 'instagram' })

  return NextResponse.redirect(new URL('/onboarding?connected=instagram', process.env.NEXT_PUBLIC_APP_URL!))
}
