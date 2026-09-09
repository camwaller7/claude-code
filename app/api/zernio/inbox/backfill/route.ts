import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { zernioEnabled } from '@/lib/platform/zernio'
import { multiUserEnabled, getCurrentUserId } from '@/lib/auth/currentUser'
import { backfillInboxSingleTenant, backfillInboxForUser } from '@/lib/platform/zernioInbox'
import { adminSupabase } from '@/lib/supabase/admin'

// Pull the recent DM history (conversations + messages + media) from Zernio into
// our inbox — the last ~30 days, bounded so it finishes inside the request.
// Called by the "Sync history" button (force=1) and once per day on login
// (debounced) so a creator never has to think about it.
const DEBOUNCE_SECONDS = 86_400 // once per day per user for the auto path

// Give the import room to page through a month of DMs across accounts without
// hitting the platform's default function timeout (which surfaced as a failed
// sync). Honoured on Vercel Pro; a no-op elsewhere.
export const maxDuration = 60

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!zernioEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'zernio_disabled' })
  }

  const uid = await getCurrentUserId()
  const force = new URL(request.url).searchParams.get('force') === '1'

  // The auto (on-load) path is debounced so reloads don't re-pull everything;
  // the button passes force=1 to bypass it. Fails open if the RPC is missing.
  if (!force) {
    try {
      const { data: allowed, error } = await adminSupabase.rpc('rate_limit_hit', {
        p_key: `inbox-backfill:${uid ?? 'pilot'}`,
        p_limit: 1,
        p_window_seconds: DEBOUNCE_SECONDS,
      })
      if (!error && allowed === false) {
        return NextResponse.json({ skipped: true, reason: 'debounced' })
      }
    } catch {
      /* fall through and sync */
    }
  }

  try {
    const result =
      multiUserEnabled() && uid ? await backfillInboxForUser(uid) : await backfillInboxSingleTenant()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[zernio/inbox/backfill] error:', err)
    return NextResponse.json({ skipped: true, reason: err instanceof Error ? err.message : String(err) })
  }
}
