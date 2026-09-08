import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import {
  zernioEnabled,
  getZernioAnalytics,
  type ZernioAnalyticsPost,
  type ZernioAnalyticsResponse,
} from '@/lib/platform/zernio'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { conflictTarget } from '@/lib/db/conflictTargets'

// ─── Zernio analytics sync ────────────────────────────────────────────────────
// Pulls follower counts and per-post performance from Zernio's unified analytics
// endpoint and writes them into follower_snapshots + content_metrics, which power
// the Audience dashboard. Replaces the direct Meta Graph insights pull now that
// Instagram/Facebook are connected through Zernio rather than Meta OAuth.
//
// Runs on the periodic sync schedule and can be triggered manually by the owner.
// Always returns 200 (with a `skipped`/`error` note) so a scheduled job no-ops
// instead of retrying a hard failure.

// Zernio reports X as "twitter"; the rest of the app uses "x".
function normalizePlatform(p?: string): string {
  return p === 'twitter' ? 'x' : (p ?? '')
}

// Map Zernio's mediaType/mediaProductType onto our content_metrics buckets.
function mediaTypeOf(post: ZernioAnalyticsPost): string {
  if (post.mediaProductType?.toUpperCase() === 'REELS') return 'reel'
  const t = post.mediaType?.toLowerCase()
  if (t === 'carousel') return 'carousel'
  if (t === 'video' || t === 'gif') return 'video'
  if (t === 'text') return 'text'
  return 'image'
}

// Write one analytics response into follower_snapshots + content_metrics,
// stamping user_id when syncing for a specific user (multi-user mode).
async function writeAnalytics(data: ZernioAnalyticsResponse, userId?: string | null) {
  const today = new Date().toISOString().slice(0, 10)
  const { posts = [], accounts = [] } = data
  const owner = userId ? { user_id: userId } : {}
  let followerSnapshots = 0
  let metricsSynced = 0

  for (const a of accounts) {
    if (typeof a.followersCount !== 'number') continue
    const platform = normalizePlatform(a.platform)
    if (!platform) continue
    const { error } = await adminSupabase.from('follower_snapshots').upsert(
      { platform, followers: a.followersCount, snapshot_date: today, ...owner },
      { onConflict: conflictTarget.followerSnapshot() }
    )
    if (!error) followerSnapshots++
  }

  for (const post of posts) {
    if (post.status && post.status !== 'published') continue
    const externalId = post._id
    if (!externalId || !post.publishedAt) continue
    const platform = normalizePlatform(post.platform)
    if (!platform) continue

    const a = post.analytics ?? {}
    const views = a.views ?? a.impressions ?? a.reach ?? 0
    const { error } = await adminSupabase.from('content_metrics').upsert(
      {
        platform,
        external_post_id: externalId,
        caption: post.content ?? null,
        media_type: mediaTypeOf(post),
        views,
        likes: a.likes ?? 0,
        comments: a.comments ?? 0,
        shares: a.shares ?? 0,
        saves: a.saves ?? 0,
        follows_gained: a.follows ?? 0,
        posted_at: post.publishedAt,
        ...owner,
      },
      { onConflict: conflictTarget.contentMetric() }
    )
    if (!error) metricsSynced++
  }

  return { followerSnapshots, metricsSynced }
}

// Single-tenant pilot: one global pull.
async function syncSingleTenant() {
  const res = await getZernioAnalytics({ limit: 100 })
  if (!res.ok || !res.data) {
    return { skipped: true as const, reason: res.error ?? 'zernio_analytics_failed' }
  }
  const written = await writeAnalytics(res.data)
  return { ...written, hasAnalyticsAccess: res.data.hasAnalyticsAccess }
}

// Multi-user: one pull per connected account, scoped and attributed to its
// owning user, so each creator's dashboard reflects only their own accounts.
async function syncMultiUser() {
  const { data: accounts } = await adminSupabase
    .from('zernio_accounts')
    .select('user_id, zernio_account_id')
  let followerSnapshots = 0
  let metricsSynced = 0
  let accountsSynced = 0
  for (const acct of accounts ?? []) {
    const res = await getZernioAnalytics({ limit: 100, accountId: acct.zernio_account_id as string })
    if (!res.ok || !res.data) continue
    const written = await writeAnalytics(res.data, acct.user_id as string)
    followerSnapshots += written.followerSnapshots
    metricsSynced += written.metricsSynced
    accountsSynced++
  }
  return { followerSnapshots, metricsSynced, accountsSynced }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!zernioEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'zernio_disabled' })
  }
  try {
    const result = multiUserEnabled() ? await syncMultiUser() : await syncSingleTenant()
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
