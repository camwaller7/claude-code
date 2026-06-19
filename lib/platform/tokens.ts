import { adminSupabase } from '@/lib/supabase/admin'

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

  const expiresAt = conn.expires_at ? new Date(conn.expires_at) : null
  const needsRefresh = expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : false

  if (!needsRefresh) {
    return conn.access_token
  }

  if (platform === 'gmail') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: conn.refresh_token!,
        grant_type: 'refresh_token',
      }),
    })
    const json = await res.json() as { access_token: string; expires_in: number }
    const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
    await adminSupabase
      .from('platform_connections')
      .update({ access_token: json.access_token, expires_at: newExpiresAt })
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
      refresh_token: conn.refresh_token!,
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
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq('id', conn.id)
  return json.access_token
}
