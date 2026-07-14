import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminSupabase } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit/log'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { encryptToken } from '@/lib/crypto/tokenCipher'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

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
  const tokenRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`, {
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
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${longLivedParams.toString()}`
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

  // Get user info
  const meRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${accessToken}`
  )
  const meData = await meRes.json() as {
    id: string
    name: string
    error?: { message: string }
  }

  if (meData.error) {
    return NextResponse.json({ error: meData.error.message }, { status: 400 })
  }

  const connectedAt = new Date().toISOString()

  // The user access token above can't send/receive Page messages or publish
  // to a Page — only a Page's own access token can. Look up the Pages this
  // user manages and store each Page's token instead.
  const accountsRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
  )
  const accountsData = await accountsRes.json() as {
    data?: { id: string; name: string; access_token: string }[]
    error?: { message: string }
  }

  if (accountsData.error) {
    return NextResponse.json({ error: accountsData.error.message }, { status: 400 })
  }

  const pages = accountsData.data ?? []
  if (pages.length === 0) {
    return NextResponse.json(
      { error: 'No Facebook Pages found for this account. A Facebook Page (which you admin) is required to receive messages and publish posts.' },
      { status: 400 }
    )
  }

  for (const page of pages) {
    await adminSupabase.from('platform_connections').upsert(
      {
        platform: 'facebook',
        account_id: page.id,
        access_token: encryptToken(page.access_token),
        refresh_token: null,
        expires_at: expiresAt,
        connected_at: connectedAt,
      },
      { onConflict: 'platform,account_id' }
    )

    // Without this, Meta never sends message events to our webhook — the
    // Page has to explicitly subscribe the app to receive them.
    const subscribeRes = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${page.access_token}`,
      { method: 'POST' }
    )
    const subscribeData = await subscribeRes.json().catch(() => ({})) as { success?: boolean; error?: { message: string } }
    if (!subscribeRes.ok || subscribeData.error) {
      console.error(`[meta/callback] webhook subscription failed for page ${page.id}:`, subscribeData.error?.message)
    }
  }

  await auditLog('platform_connected', { platform: 'facebook', pageCount: pages.length })

  return NextResponse.redirect(new URL('/onboarding?connected=meta', process.env.NEXT_PUBLIC_APP_URL!))}
