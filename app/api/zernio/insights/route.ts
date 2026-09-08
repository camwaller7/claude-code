import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { zernioEnabled } from '@/lib/platform/zernio'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { syncSingleTenant, syncAllMultiUser } from '@/lib/platform/zernioInsights'

// ─── Zernio analytics sync (scheduled / owner-triggered) ──────────────────────
// Pulls follower counts and per-post performance from Zernio into
// follower_snapshots + content_metrics, which power the Audience dashboard and
// the post portal's performance summaries. Runs on the daily cron (via the
// syncAnalytics Inngest job) and can be triggered manually. The per-user,
// debounced login sync lives at /api/zernio/insights/self. Always returns 200
// (with a `skipped`/`error` note) so a scheduled job no-ops instead of retrying.

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!zernioEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'zernio_disabled' })
  }
  try {
    const result = multiUserEnabled() ? await syncAllMultiUser() : await syncSingleTenant()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[zernio/insights] sync error:', err)
    return NextResponse.json({ skipped: true, reason: err instanceof Error ? err.message : String(err) })
  }
}

// Convenience GET so the owner can trigger a sync from the browser.
export async function GET(request: Request) {
  return POST(request)
}
