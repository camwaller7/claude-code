import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { configureZernioWebhook } from '@/lib/platform/zernio'

// Owner-only: registers (or updates) the Zernio webhook so inbound DMs are
// delivered to /api/webhooks/zernio. Reads the target URL from the request
// origin and the shared secret from ZERNIO_WEBHOOK_SECRET, so there's nothing
// to hand-configure in the Zernio dashboard. Visit this once, logged in, after
// ZERNIO_WEBHOOK_SECRET is set. Returns no secrets.
export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'ZERNIO_WEBHOOK_SECRET is not set in the environment.' },
      { status: 200 }
    )
  }

  // Derive the public webhook URL from this request's origin so it matches the
  // deployment it's called from (production domain when hit in the browser).
  const origin = new URL(request.url).origin
  const webhookUrl = `${origin}/api/webhooks/zernio`

  const res = await configureZernioWebhook(webhookUrl, secret)
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, webhookUrl, error: res.error, status: res.status },
      { status: 200 }
    )
  }

  return NextResponse.json({ ok: true, webhookUrl, result: res.data })
}
