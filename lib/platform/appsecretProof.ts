import { createHmac } from 'crypto'

// Meta recommends (and, when the app's "Require app secret proof for server API
// calls" setting is on, requires) that server-side Graph API calls carrying an
// access token also send appsecret_proof: HMAC-SHA256 of the access token keyed
// by the app secret. The secret differs per product — Facebook Page tokens are
// issued by the Meta app (META_APP_SECRET); Instagram Business Login tokens by
// the Instagram app (INSTAGRAM_APP_SECRET).
export function appsecretProof(
  token: string,
  platform: 'facebook' | 'instagram'
): string | null {
  const secret =
    platform === 'instagram'
      ? process.env.INSTAGRAM_APP_SECRET
      : process.env.META_APP_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(token).digest('hex')
}
