import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/auth/currentUser'

// Zernio redirects here after a hosted connect flow, appending
// connected={platform}&profileId=…&accountId=…&username=… (or error=… on
// failure). The browser is logged in, so we tie the freshly connected Zernio
// account to the current app user in zernio_accounts, then bounce to Settings.
//
// normalizePlatform mirrors the rest of the app: Zernio reports X as "twitter".
function normalizePlatform(p: string | null): string {
  return p === 'twitter' ? 'x' : (p ?? '')
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const params = url.searchParams

  const settings = (suffix: string) => NextResponse.redirect(`${origin}/settings?${suffix}`)

  const error = params.get('error')
  if (error) {
    return settings(`zernio_error=${encodeURIComponent(error)}`)
  }

  const accountId = params.get('accountId')
  const platform = normalizePlatform(params.get('connected') ?? params.get('platform'))
  const username = params.get('username') ?? undefined

  if (!accountId || !platform) {
    return settings('zernio_error=missing_account')
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    // Session expired mid-flow — send them to log in, then retry the connect.
    return NextResponse.redirect(`${origin}/auth/login?next=/settings`)
  }

  // Idempotent: zernio_account_id is unique. Re-connecting the same account
  // re-points it at the current user rather than erroring.
  const { error: dbError } = await adminSupabase
    .from('zernio_accounts')
    .upsert(
      {
        user_id: userId,
        zernio_account_id: accountId,
        platform,
        username: username ?? null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'zernio_account_id' }
    )

  if (dbError) {
    return settings(`zernio_error=${encodeURIComponent(dbError.message)}`)
  }
  return settings(`connected=${encodeURIComponent(platform)}`)
}
