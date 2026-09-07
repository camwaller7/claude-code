import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

// Streams a message attachment. Instagram/Facebook/WhatsApp media URLs from
// Zernio require the API key (which the browser can't send), so an <img>/<video>
// points here and we fetch the upstream with the Bearer key server-side. Only
// Zernio-hosted URLs are proxied — anything else is refused to avoid an open
// proxy / SSRF. Owner/authenticated access only.
function isZernioUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && (u.hostname === 'zernio.com' || u.hostname.endsWith('.zernio.com'))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const target = new URL(request.url).searchParams.get('url')
  if (!target || !isZernioUrl(target)) {
    return NextResponse.json({ error: 'Invalid media URL' }, { status: 400 })
  }

  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Media not available' }, { status: 502 })

  const upstream = await fetch(target, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Could not load media' }, { status: 502 })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      // Media for a given attachment URL is immutable; let the browser cache it.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
