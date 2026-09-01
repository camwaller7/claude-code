import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { zernioEnabled, listZernioAccounts } from '@/lib/platform/zernio'

// Owner-only diagnostic: confirms the ZERNIO_API_KEY works and lists which
// social accounts are connected in Zernio. Returns no tokens/secrets — only
// account id/platform/username — so it's safe to read in the browser while
// setting the integration up. Visit /api/zernio/status when logged in.
export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const hasKey = Boolean(process.env.ZERNIO_API_KEY)
  if (!hasKey) {
    return NextResponse.json({ hasKey: false, enabled: zernioEnabled(), accounts: [] })
  }

  const res = await listZernioAccounts()
  if (!res.ok) {
    return NextResponse.json(
      { hasKey: true, enabled: zernioEnabled(), keyValid: false, error: res.error, status: res.status },
      { status: 200 }
    )
  }

  // The accounts endpoint may return either an array or { accounts: [...] }.
  const raw = res.data as unknown
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { accounts?: unknown[] })?.accounts ?? [])
  const accounts = (list as Array<Record<string, unknown>>).map((a) => ({
    id: a.id,
    platform: a.platform,
    username: a.username ?? a.name ?? null,
  }))

  return NextResponse.json({ hasKey: true, enabled: zernioEnabled(), keyValid: true, accounts })
}
