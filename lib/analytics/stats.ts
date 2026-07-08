import { adminSupabase } from '@/lib/supabase/admin'

export interface FollowerPoint {
  date: string
  total: number
  byPlatform: Record<string, number>
}

export interface PostPerformance {
  id: string
  platform: string
  caption: string | null
  media_type: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  follows_gained: number
  interactions: number
  engagement_rate: number // interactions / views
  posted_at: string
}

export interface ContentAnalytics {
  followers: {
    current_total: number
    byPlatform: Record<string, number>
    net_change_7d: number
    net_change_30d: number
    trend_30d: FollowerPoint[]
  }
  last7days: {
    views: number
    interactions: number
    posts_published: number
    avg_engagement_rate: number
  }
  top_post: PostPerformance | null
  worst_post: PostPerformance | null
  posts: PostPerformance[]
  breakdown: {
    by_media_type: Record<string, { posts: number; avg_views: number; avg_engagement_rate: number }>
    by_platform: Record<string, { posts: number; views: number; interactions: number; avg_engagement_rate: number }>
    best_posting_hours: { hour: number; avg_views: number }[]
  }
}

function interactionsOf(m: { likes: number; comments: number; shares: number; saves: number }) {
  return m.likes + m.comments + m.shares + m.saves
}

export async function getContentAnalytics(): Promise<ContentAnalytics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const sevenDaysAgoTs = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [{ data: snaps }, { data: metrics }] = await Promise.all([
    adminSupabase
      .from('follower_snapshots')
      .select('platform, followers, snapshot_date')
      .gte('snapshot_date', thirtyDaysAgo)
      .order('snapshot_date', { ascending: true }),
    adminSupabase
      .from('content_metrics')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(200),
  ])

  // ---- follower trend ----
  const byDate = new Map<string, Record<string, number>>()
  for (const s of snaps ?? []) {
    const d = byDate.get(s.snapshot_date) ?? {}
    d[s.platform] = s.followers
    byDate.set(s.snapshot_date, d)
  }
  // carry forward missing platform values so totals don't dip artificially
  const dates = [...byDate.keys()].sort()
  const carried: Record<string, number> = {}
  const trend: FollowerPoint[] = dates.map(date => {
    Object.assign(carried, byDate.get(date))
    const byPlatform = { ...carried }
    return { date, total: Object.values(byPlatform).reduce((a, b) => a + b, 0), byPlatform }
  })

  const latest = trend[trend.length - 1]
  const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)
  const weekAgoPoint = [...trend].reverse().find(p => p.date <= sevenDaysAgoDate) ?? trend[0]
  const firstPoint = trend[0]

  // ---- post performance ----
  const posts: PostPerformance[] = (metrics ?? []).map(m => {
    const interactions = interactionsOf(m)
    return {
      id: m.id,
      platform: m.platform,
      caption: m.caption,
      media_type: m.media_type,
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
      follows_gained: m.follows_gained,
      interactions,
      engagement_rate: m.views > 0 ? +(interactions / m.views * 100).toFixed(2) : 0,
      posted_at: m.posted_at,
    }
  })

  const recent = posts.filter(p => p.posted_at >= sevenDaysAgoTs)
  const scored = [...posts].sort((a, b) => (b.views + b.interactions * 10) - (a.views + a.interactions * 10))

  // ---- breakdowns ----
  const byType: ContentAnalytics['breakdown']['by_media_type'] = {}
  const byPlatform: ContentAnalytics['breakdown']['by_platform'] = {}
  const hourBuckets = new Map<number, { views: number; n: number }>()

  for (const p of posts) {
    const t = byType[p.media_type] ?? { posts: 0, avg_views: 0, avg_engagement_rate: 0 }
    t.posts += 1
    t.avg_views += p.views
    t.avg_engagement_rate += p.engagement_rate
    byType[p.media_type] = t

    const pl = byPlatform[p.platform] ?? { posts: 0, views: 0, interactions: 0, avg_engagement_rate: 0 }
    pl.posts += 1
    pl.views += p.views
    pl.interactions += p.interactions
    pl.avg_engagement_rate += p.engagement_rate
    byPlatform[p.platform] = pl

    const hour = new Date(p.posted_at).getUTCHours()
    const h = hourBuckets.get(hour) ?? { views: 0, n: 0 }
    h.views += p.views
    h.n += 1
    hourBuckets.set(hour, h)
  }
  for (const t of Object.values(byType)) {
    t.avg_views = Math.round(t.avg_views / t.posts)
    t.avg_engagement_rate = +(t.avg_engagement_rate / t.posts).toFixed(2)
  }
  for (const pl of Object.values(byPlatform)) {
    pl.avg_engagement_rate = +(pl.avg_engagement_rate / pl.posts).toFixed(2)
  }
  const bestHours = [...hourBuckets.entries()]
    .map(([hour, { views, n }]) => ({ hour, avg_views: Math.round(views / n) }))
    .sort((a, b) => b.avg_views - a.avg_views)
    .slice(0, 3)

  const totalViews7d = recent.reduce((s, p) => s + p.views, 0)
  const totalInteractions7d = recent.reduce((s, p) => s + p.interactions, 0)

  return {
    followers: {
      current_total: latest?.total ?? 0,
      byPlatform: latest?.byPlatform ?? {},
      net_change_7d: latest && weekAgoPoint ? latest.total - weekAgoPoint.total : 0,
      net_change_30d: latest && firstPoint ? latest.total - firstPoint.total : 0,
      trend_30d: trend,
    },
    last7days: {
      views: totalViews7d,
      interactions: totalInteractions7d,
      posts_published: recent.length,
      avg_engagement_rate: recent.length
        ? +(recent.reduce((s, p) => s + p.engagement_rate, 0) / recent.length).toFixed(2)
        : 0,
    },
    top_post: scored[0] ?? null,
    worst_post: scored.length > 1 ? scored[scored.length - 1] : null,
    posts: posts.slice(0, 50),
    breakdown: {
      by_media_type: byType,
      by_platform: byPlatform,
      best_posting_hours: bestHours,
    },
  }
}
