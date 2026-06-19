import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('meta_oauth_state')?.value

  if (!state || state !== savedState) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  cookieStore.delete('meta_oauth_state')

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  })
  const tokenData = await tokenRes.json() as { access_token: string; error?: { message: string } }

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error.message }, { status: 400 })
  }

  // Exchange for long-lived token
  const longLivedParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: tokenData.access_token,
  })
  const longLivedRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${longLivedParams.toString()}`
  )
  const longLivedData = await longLivedRes.json() as {
    access_token: string
    expires_in?: number
    error?: { message: string }
  }

  if (longLivedData.error) {
    return NextResponse.json({ error: longLivedData.error.message }, { status: 400 })
  }

  const accessToken = longLivedData.access_token
  const expiresAt = longLivedData.expires_in
    ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
    : null

  // Get user info / Instagram Business Account ID
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,instagram_business_account&access_token=${accessToken}`
  )
  const meData = await meRes.json() as {
    id: string
    name: string
    instagram_business_account?: { id: string }
    error?: { message: string }
  }

  if (meData.error) {
    return NextResponse.json({ error: meData.error.message }, { status: 400 })
  }

  const connectedAt = new Date().toISOString()

  // Upsert facebook connection
  await adminSupabase.from('platform_connections').upsert(
    {
      platform: 'facebook',
      account_id: meData.id,
      access_token: accessToken,
      refresh_token: null,
      expires_at: expiresAt,
      connected_at: connectedAt,
    },
    { onConflict: 'platform,account_id' }
  )

  // Upsert instagram connection if we have an IG business account
  if (meData.instagram_business_account?.id) {
    await adminSupabase.from('platform_connections').upsert(
      {
        platform: 'instagram',
        account_id: meData.instagram_business_account.id,
        access_token: accessToken,
        refresh_token: null,
        expires_at: expiresAt,
        connected_at: connectedAt,
      },
      { onConflict: 'platform,account_id' }
    )
  }

  return NextResponse.redirect(new URL('/onboarding?connected=meta', request.url))
}
