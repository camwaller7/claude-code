'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Eye, Heart, Trophy, Clock, Globe } from 'lucide-react'
import type { ContentAnalytics, PlatformAnalytics, PostPerformance } from '@/lib/analytics/stats'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', x: 'X', threads: 'Threads', tiktok: 'TikTok',
}

interface ViewModel {
  followersCurrent: number
  netChange7d: number
  netChange30d: number
  trend: { day: string; followers: number }[]
  views: number
  interactions: number
  postsPublished: number
  avgEngagement: number
  bestHour: number | null
  topPost: PostPerformance | null
  byMediaType: Record<string, { posts: number; avg_views: number; avg_engagement_rate: number }>
  scopeLabel: string
  byPlatformFooter?: Record<string, number>
}

function toDay(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function totalViewModel(a: ContentAnalytics): ViewModel {
  return {
    followersCurrent: a.followers.current_total,
    netChange7d: a.followers.net_change_7d,
    netChange30d: a.followers.net_change_30d,
    trend: a.followers.trend_30d.map(p => ({ day: toDay(p.date), followers: p.total })),
    views: a.last30days.views,
    interactions: a.last30days.interactions,
    postsPublished: a.last30days.posts_published,
    avgEngagement: a.last30days.avg_engagement_rate,
    bestHour: a.breakdown.best_posting_hours[0]?.hour ?? null,
    topPost: a.top_post,
    byMediaType: a.breakdown.by_media_type,
    scopeLabel: 'All platforms',
    byPlatformFooter: a.followers.byPlatform,
  }
}

// Content platforms the portal can post to — always offered as tabs so a
// creator can select any platform, even before it has synced any data.
const CONTENT_PLATFORMS = ['instagram', 'facebook', 'x', 'threads', 'tiktok']

// A zeroed view for a platform with no analytics yet, so its tab still works.
function zeroViewModel(platform: string): ViewModel {
  return {
    followersCurrent: 0,
    netChange7d: 0,
    netChange30d: 0,
    trend: [],
    views: 0,
    interactions: 0,
    postsPublished: 0,
    avgEngagement: 0,
    bestHour: null,
    topPost: null,
    byMediaType: {},
    scopeLabel: PLATFORM_LABELS[platform] ?? platform,
  }
}

function platformViewModel(p: PlatformAnalytics): ViewModel {
  return {
    followersCurrent: p.followers.current,
    netChange7d: p.followers.net_change_7d,
    netChange30d: p.followers.net_change_30d,
    trend: p.followers.trend_30d.map(s => ({ day: toDay(s.date), followers: s.followers })),
    views: p.last30days.views,
    interactions: p.last30days.interactions,
    postsPublished: p.last30days.posts_published,
    avgEngagement: p.last30days.avg_engagement_rate,
    bestHour: p.best_posting_hours[0]?.hour ?? null,
    topPost: p.top_post,
    byMediaType: p.by_media_type,
    scopeLabel: PLATFORM_LABELS[p.platform] ?? p.platform,
  }
}

function MetricTiles({ vm }: { vm: ViewModel }) {
  const up7 = vm.netChange7d >= 0
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-2xl border bg-card card-elevated p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Followers</p>
          {up7 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
        </div>
        <p className="text-xl font-bold">{fmt(vm.followersCurrent)}</p>
        <p className={`text-xs font-medium ${up7 ? 'text-emerald-600' : 'text-red-500'}`}>
          {up7 ? '+' : ''}{fmt(vm.netChange7d)} this week
        </p>
      </div>
      <div className="rounded-2xl border bg-card card-elevated p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Views</p>
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-xl font-bold">{fmt(vm.views)}</p>
        <p className="text-xs text-muted-foreground">{vm.postsPublished} posts · 7d</p>
      </div>
      <div className="rounded-2xl border bg-card card-elevated p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Interactions</p>
          <Heart className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-xl font-bold">{fmt(vm.interactions)}</p>
        <p className="text-xs text-muted-foreground">{vm.avgEngagement}% avg engagement</p>
      </div>
      <div className="rounded-2xl border bg-card card-elevated p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Best time</p>
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-xl font-bold">{vm.bestHour != null ? `${vm.bestHour}:00` : '—'}</p>
        <p className="text-xs text-muted-foreground">highest avg views</p>
      </div>
    </div>
  )
}

function GrowthAndTop({ vm }: { vm: ViewModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold">Follower Growth</p>
          <p className="text-xs text-muted-foreground">
            {vm.scopeLabel} · {vm.netChange30d >= 0 ? '+' : ''}{fmt(vm.netChange30d)} in 30 days
          </p>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={vm.trend}>
            <defs>
              <linearGradient id="followersGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand-accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--brand-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
            <Area type="monotone" dataKey="followers" stroke="var(--brand-accent)" strokeWidth={2} fill="url(#followersGrad)" name="Followers" />
          </AreaChart>
        </ResponsiveContainer>
        {vm.byPlatformFooter && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(vm.byPlatformFooter).map(([platform, count]) => (
              <span key={platform} className="text-xs text-muted-foreground">
                {PLATFORM_LABELS[platform] ?? platform}: <b className="text-foreground">{fmt(count)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card card-elevated p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <p className="font-semibold">Top Post</p>
        </div>
        {vm.topPost ? (
          <>
            <p className="text-sm line-clamp-3">{vm.topPost.caption ?? '(no caption)'}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-sm font-bold">{fmt(vm.topPost.views)}</p><p className="text-[10px] text-muted-foreground">views</p></div>
              <div><p className="text-sm font-bold">{fmt(vm.topPost.likes)}</p><p className="text-[10px] text-muted-foreground">likes</p></div>
              <div><p className="text-sm font-bold">{fmt(vm.topPost.comments)}</p><p className="text-[10px] text-muted-foreground">comments</p></div>
              <div><p className="text-sm font-bold">{vm.topPost.engagement_rate}%</p><p className="text-[10px] text-muted-foreground">engagement</p></div>
            </div>
            <p className="text-xs text-muted-foreground">
              {PLATFORM_LABELS[vm.topPost.platform] ?? vm.topPost.platform} · {vm.topPost.media_type} · +{vm.topPost.follows_gained} follows from this post
            </p>
            <div className="mt-1 border-t pt-2 flex flex-col gap-1">
              <p className="text-xs font-medium">By format (avg views)</p>
              {Object.entries(vm.byMediaType)
                .sort((a, b) => b[1].avg_views - a[1].avg_views)
                .map(([type, s]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{type} ({s.posts})</span>
                    <span className="font-semibold">{fmt(s.avg_views)}</span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No post metrics yet for this view — they&apos;ll appear once your platforms sync (or run the analytics demo seed).</p>
        )}
      </div>
    </div>
  )
}

export function AudiencePanel({ analytics }: { analytics: ContentAnalytics }) {
  const [tab, setTab] = useState<string>('all')

  const byPlatform = new Map(analytics.platforms.map(p => [p.platform, p]))
  // Show every content platform as a tab (plus any that have data but aren't in
  // the standard list), so all platforms are always selectable here.
  const platformOrder = [
    ...CONTENT_PLATFORMS,
    ...analytics.platforms.map(p => p.platform).filter(p => !CONTENT_PLATFORMS.includes(p)),
  ]
  const active: ViewModel =
    tab === 'all'
      ? totalViewModel(analytics)
      : byPlatform.has(tab)
        ? platformViewModel(byPlatform.get(tab)!)
        : zeroViewModel(tab)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold text-lg">Audience &amp; Content</p>
        <p className="text-xs text-muted-foreground">
          Per-platform performance and your brand-wide totals — spot what&apos;s working and where to focus
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab('all')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'all' ? 'bg-[var(--brand-accent)] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="h-3.5 w-3.5" />
          All Platforms
        </button>
        {platformOrder.map(platform => (
          <button
            key={platform}
            onClick={() => setTab(platform)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tab === platform ? 'bg-[var(--brand-accent)] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {PLATFORM_LABELS[platform] ?? platform}
          </button>
        ))}
      </div>

      <MetricTiles vm={active} />
      <GrowthAndTop vm={active} />
    </div>
  )
}
