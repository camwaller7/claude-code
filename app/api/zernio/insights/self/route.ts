import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { zernioEnabled } from '@/lib/platform/zernio'
import { multiUserEnabled, getCurrentUserId } from '@/lib/auth/currentUser'
import { syncSingleTenant, syncUserAccounts } from '@/lib/platform/zernioInsights'

// Per-user analytics refresh, triggered when the app loads after login. Debounced
// to once per 15 minutes per user (via the rate_limits table) so reloads and
// rapid navigation don't hammer Zernio — the daily cron still runs regardless.
// Fire-and-forget from the client; always returns 200 with a note.
const DEBOUNCE_SECONDS = 900

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!zernioEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'zernio_disabled' })
  }

  const uid = await getCurrentUserId()
  const key = `analytics-sync:${uid ?? 'pilot'}`

  // Debounce. If the RPC is unavailable (migration not yet applied), fail open
  // and sync — the cost is an extra pull, not a broken feature.
  try {
    const { data: allowed, error } = await adminSupabase.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: 1,
      p_window_seconds: DEBOUNCE_SECONDS,
    })
    if (!error && allowed === false) {
      return NextResponse.json({ skipped: true, reason: 'debounced' })
    }
  } catch {
    /* fall through and sync */
  }

  try {
    const result =
      multiUserEnabled() && uid ? await syncUserAccounts(uid) : await syncSingleTenant()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[zernio/insights/self] sync error:', err)
    return NextResponse.json({ skipped: true, reason: err instanceof Error ? err.message : String(err) })
  }
}
