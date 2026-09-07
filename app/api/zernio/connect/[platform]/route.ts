import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { zernioEnabled, getZernioConnectUrl, type ZernioPlatform } from '@/lib/platform/zernio'

// Start the per-user Zernio connect flow. The signed-in user hits this to link
// their own Instagram/Facebook; we return the Zernio hosted OAuth URL for the
// browser to redirect to. Zernio sends the user back to /api/zernio/connect/
// callback with the new account id, which we then map to this user.
const ALLOWED: ZernioPlatform[] = ['instagram', 'facebook', 'telegram', 'whatsapp']

export async function GET(request: Request, ctx: { params: Promise<{ platform: string }> }) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!zernioEnabled()) {
    return NextResponse.json({ ok: false, error: 'Zernio is not enabled.' }, { status: 200 })
  }

  const { platform } = await ctx.params
  if (!ALLOWED.includes(platform as ZernioPlatform)) {
    return NextResponse.json({ ok: false, error: `Unsupported platform: ${platform}` }, { status: 200 })
  }

  const origin = new URL(request.url).origin
  const redirectUrl = `${origin}/api/zernio/connect/callback`
  const res = await getZernioConnectUrl(platform as ZernioPlatform, redirectUrl)
  if (!res.ok || !res.data?.authUrl) {
    return NextResponse.json({ ok: false, error: res.error ?? 'Could not get a connect URL.' }, { status: 200 })
  }
  return NextResponse.json({ ok: true, authUrl: res.data.authUrl })
}
