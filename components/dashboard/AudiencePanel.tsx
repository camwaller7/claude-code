'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, Eye, Heart, Trophy, Clock } from 'lucide-react'
import type { ContentAnalytics } from '@/lib/analytics/stats'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', x: 'X', threads: 'Threads', tiktok: 'TikTok',
}

export function AudiencePanel({ analytics }: { analytics: ContentAnalytics }) {
  const f = analytics.followers
  const wk = analytics.last7days
  const top = analytics.top_post
  const up7 = f.net_change_7d >= 0

  const trendData = f.trend_30d.map(p => ({
    day: new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    followers: p.total,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold text-lg">Audience &amp; Content</p>
        <p className="text-xs text-muted-foreground">How your content performed — last 7 days</p>
      </div>

      {/* Key metric tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Followers</p>
            {up7 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          </div>
          <p className="text-xl font-bold">{fmt(f.current_total)}</p>
          <p className={`text-xs font-medium ${up7 ? 'text-emerald-600' : 'text-red-500'}`}>
            {up7 ? '+' : ''}{fmt(f.net_change_7d)} this week
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Views</p>
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{fmt(wk.views)}</p>
          <p className="text-xs text-muted-foreground">{wk.posts_published} posts</p>
        </div>
        <div className="rounded-2xl border bg-card p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Interactions</p>
            <Heart className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{fmt(wk.interactions)}</p>
          <p className="text-xs text-muted-foreground">{wk.avg_engagement_rate}% avg engagement</p>
        </div>
        <div className="rounded-2xl border bg-card p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Best time</p>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">
            {analytics.breakdown.best_posting_hours[0] != null
              ? `${analytics.breakdown.best_posting_hours[0].hour}:00`
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground">highest avg views</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Follower growth chart */}
        <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold">Follower Growth</p>
            <p className="text-xs text-muted-foreground">
              All platforms · {f.net_change_30d >= 0 ? '+' : ''}{fmt(f.net_change_30d)} in 30 days
            </p>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trendData}>
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
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(f.byPlatform).map(([platform, count]) => (
              <span key={platform} className="text-xs text-muted-foreground">
                {PLATFORM_LABELS[platform] ?? platform}: <b className="text-foreground">{fmt(count)}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Top post */}
        <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="font-semibold">Top Post</p>
          </div>
          {top ? (
            <>
              <p className="text-sm line-clamp-3">{top.caption ?? '(no caption)'}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-sm font-bold">{fmt(top.views)}</p><p className="text-[10px] text-muted-foreground">views</p></div>
                <div><p className="text-sm font-bold">{fmt(top.likes)}</p><p className="text-[10px] text-muted-foreground">likes</p></div>
                <div><p className="text-sm font-bold">{fmt(top.comments)}</p><p className="text-[10px] text-muted-foreground">comments</p></div>
                <div><p className="text-sm font-bold">{top.engagement_rate}%</p><p className="text-[10px] text-muted-foreground">engagement</p></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {PLATFORM_LABELS[top.platform] ?? top.platform} · {top.media_type} · +{top.follows_gained} follows from this post
              </p>
              {/* What's working, by format */}
              <div className="mt-1 border-t pt-2 flex flex-col gap-1">
                <p className="text-xs font-medium">By format (avg views)</p>
                {Object.entries(analytics.breakdown.by_media_type)
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
            <p className="text-sm text-muted-foreground">No post metrics yet — they&apos;ll appear once your platforms sync (or run the analytics demo seed).</p>
          )}
        </div>
      </div>
    </div>
  )
}
