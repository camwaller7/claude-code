import { adminSupabase } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from '@/lib/crypto/tokenCipher'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'

export async function getValidToken(platform: 'gmail' | 'x'): Promise<string> {
  const { data: conn, error } = await adminSupabase
    .from('platform_connections')
    .select('*')
    .eq('platform', platform)
    .limit(1)
    .single()

  if (error || !conn) {
    throw new Error(`No platform connection found for ${platform}`)
  }

  const accessToken = decryptToken(conn.access_token)!
  const refreshToken = decryptToken(conn.refresh_token)

  const expiresAt = conn.expires_at ? new Date(conn.expires_at) : null
  const needsRefresh = expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : false

  if (!needsRefresh) {
    return accessToken
  }

  if (platform === 'gmail') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: refreshToken!,
        grant_type: 'refresh_token',
      }),
    })
    const json = await res.json() as { access_token: string; expires_in: number }
    const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
    await adminSupabase
      .from('platform_connections')
      .update({ access_token: encryptToken(json.access_token), expires_at: newExpiresAt })
      .eq('id', conn.id)
    return json.access_token
  }

  // X
  const credentials = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken!,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  await adminSupabase
    .from('platform_connections')
    .update({
      access_token: encryptToken(json.access_token),
      refresh_token: encryptToken(json.refresh_token),
      expires_at: newExpiresAt,
    })
    .eq('id', conn.id)
  return json.access_token
}

interface MetaConnection {
  id: string
  access_token: string
  expires_at: string | null
}

// Facebook/Instagram/Threads long-lived tokens (~60 days) have no refresh_token
// — they're extended by re-exchanging the still-valid current token for a new
// one before it expires. Without this, every Meta connection silently dies
// ~60 days after connecting with no reconnect prompt.
async function refreshMetaToken(
  platform: 'facebook' | 'instagram' | 'threads',
  conn: MetaConnection
): Promise<string> {
  if (platform === 'facebook') {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: conn.access_token,
    })
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`)
    const json = await res.json() as { access_token?: string; expires_in?: number; error?: { message: string } }
    if (!res.ok || !json.access_token) {
      throw new Error(`Facebook token refresh failed: ${json.error?.message ?? res.status}`)
    }
    const newExpiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null
    await adminSupabase
      .from('platform_connections')
      .update({ access_token: encryptToken(json.access_token), expires_at: newExpiresAt })
      .eq('id', conn.id)
    return json.access_token
  }

  if (platform === 'instagram') {
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: conn.access_token,
    })
    const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`)
    const json = await res.json() as { access_token?: string; expires_in?: number; error_message?: string }
    if (!res.ok || !json.access_token) {
      throw new Error(`Instagram token refresh failed: ${json.error_message ?? res.status}`)
    }
    const newExpiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null
    await adminSupabase
      .from('platform_connections')
      .update({ access_token: encryptToken(json.access_token), expires_at: newExpiresAt })
      .eq('id', conn.id)
    return json.access_token
  }

  // Threads uses the same long-lived-token refresh pattern as Instagram.
  const params = new URLSearchParams({
    grant_type: 'th_refresh_token',
    access_token: conn.access_token,
  })
  const res = await fetch(`https://graph.threads.net/refresh_access_token?${params.toString()}`)
  const json = await res.json() as { access_token?: string; expires_in?: number; error_message?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(`Threads token refresh failed: ${json.error_message ?? res.status}`)
  }
  const newExpiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null
  await adminSupabase
    .from('platform_connections')
    .update({ access_token: encryptToken(json.access_token), expires_at: newExpiresAt })
    .eq('id', conn.id)
  return json.access_token
}

// Meta platforms can have multiple connections (e.g. multiple Facebook Pages),
// so callers pass the specific account_id rather than getting "the" connection.
export async function getValidMetaToken(
  platform: 'facebook' | 'instagram' | 'threads',
  accountId: string
): Promise<string> {
  const { data: conn, error } = await adminSupabase
    .from('platform_connections')
    .select('id, access_token, expires_at')
    .eq('platform', platform)
    .eq('account_id', accountId)
    .single()

  if (error || !conn) {
    throw new Error(`No ${platform} connection found for account ${accountId}`)
  }

  const decryptedConn: MetaConnection = { ...conn, access_token: decryptToken(conn.access_token)! }

  const expiresAt = conn.expires_at ? new Date(conn.expires_at) : null
  // Refresh proactively well before expiry (Meta long-lived tokens last ~60
  // days) rather than waiting until they're nearly dead.
  const needsRefresh = expiresAt ? expiresAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 : false

  if (!needsRefresh) return decryptedConn.access_token

  try {
    return await refreshMetaToken(platform, decryptedConn)
  } catch (err) {
    console.error(`[tokens] ${platform} refresh failed, falling back to existing token:`, err)
    // Fall back to the current token rather than hard-failing the caller —
    // it may still be valid for a few more days even if refresh failed.
    return decryptedConn.access_token
  }
}
