import { adminSupabase } from '@/lib/supabase/admin'
import {
  getZernioAnalytics,
  type ZernioAnalyticsPost,
  type ZernioAnalyticsResponse,
} from '@/lib/platform/zernio'
import { conflictTarget } from '@/lib/db/conflictTargets'

// Zernio analytics → follower_snapshots + content_metrics. Shared by the
// scheduled/owner sync route and the debounced per-user login sync.

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
export async function writeAnalytics(data: ZernioAnalyticsResponse, userId?: string | null) {
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
export async function syncSingleTenant() {
  const res = await getZernioAnalytics({ limit: 100 })
  if (!res.ok || !res.data) {
    return { skipped: true as const, reason: res.error ?? 'zernio_analytics_failed' }
  }
  const written = await writeAnalytics(res.data)
  return { ...written, hasAnalyticsAccess: res.data.hasAnalyticsAccess }
}

// Multi-user, all accounts (the scheduled cron): one pull per connected account,
// attributed to its owning user.
export async function syncAllMultiUser() {
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

// Multi-user, a single user's accounts (the login-triggered sync). Keeps a
// creator's dashboard fresh without pulling every other tenant's data.
export async function syncUserAccounts(userId: string) {
  const { data: accounts } = await adminSupabase
    .from('zernio_accounts')
    .select('zernio_account_id')
    .eq('user_id', userId)
  let followerSnapshots = 0
  let metricsSynced = 0
  let accountsSynced = 0
  for (const acct of accounts ?? []) {
    const res = await getZernioAnalytics({ limit: 100, accountId: acct.zernio_account_id as string })
    if (!res.ok || !res.data) continue
    const written = await writeAnalytics(res.data, userId)
    followerSnapshots += written.followerSnapshots
    metricsSynced += written.metricsSynced
    accountsSynced++
  }
  return { followerSnapshots, metricsSynced, accountsSynced }
}
