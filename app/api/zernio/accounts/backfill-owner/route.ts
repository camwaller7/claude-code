import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { currentUserIsOwner } from '@/lib/auth/currentUser'
import { getOwnerUserId } from '@/lib/auth/ownerUser'
import { listZernioAccounts, zernioAccountId } from '@/lib/platform/zernio'
import { adminSupabase } from '@/lib/supabase/admin'

// Owner-only, one-time: map the owner's already-connected Zernio accounts into
// zernio_accounts. The owner connected in the pilot, before that table existed,
// so at multi-user cutover their accounts are unmapped — which would break
// replying, publishing and per-account insights (all resolve the sending account
// from zernio_accounts). This reads the live Zernio account list and claims any
// account NOT already mapped for the owner. It never touches accounts a creator
// has already mapped to themselves, so it's safe to run anytime.

function normPlatform(p?: string): string {
  return p === 'twitter' ? 'x' : (p ?? '')
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized
  if (!(await currentUserIsOwner())) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  const ownerId = await getOwnerUserId()
  if (!ownerId) {
    return NextResponse.json({ error: 'Owner user could not be resolved (check OWNER_EMAIL / app_owner).' }, { status: 500 })
  }

  const res = await listZernioAccounts()
  if (!res.ok || !res.data) {
    return NextResponse.json({ error: res.error ?? 'Could not list Zernio accounts.' }, { status: 502 })
  }
  const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []

  let mapped = 0
  const claimed: { platform: string; username?: string }[] = []
  for (const a of accounts) {
    const id = zernioAccountId(a)
    if (!id) continue
    // Skip any account already mapped (to the owner or a creator) — never steal.
    const { data: existing } = await adminSupabase
      .from('zernio_accounts')
      .select('id')
      .eq('zernio_account_id', id)
      .maybeSingle()
    if (existing) continue

    const platform = normPlatform(String(a.platform))
    const username = a.username ?? a.name ?? a.displayName ?? null
    const { error } = await adminSupabase.from('zernio_accounts').insert({
      user_id: ownerId,
      zernio_account_id: id,
      platform,
      username,
    })
    if (error) {
      console.error('[zernio-backfill-owner] insert failed:', error.message)
      continue
    }
    mapped++
    claimed.push({ platform, username: username ?? undefined })
  }

  return NextResponse.json({ ok: true, mapped, total: accounts.length, claimed })
}
