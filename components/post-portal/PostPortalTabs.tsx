'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Send, CheckCircle2, Eye, Heart, MessageCircle, Share2, CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PublishNowButton } from '@/components/post-portal/PublishNowButton'
import { formatDate } from '@/lib/utils'
import type { Post, PostStatus } from '@/types'

export interface PlatformMetric {
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
}

// A published post shown in the Created tab — from content_metrics (native or
// Corvelle, synced) or a just-published Corvelle post not yet synced.
export interface CreatedPost {
  id: string
  caption: string
  platforms: string[]
  posted_at: string | null
  status: 'published' | 'partial' | 'failed'
  perPlatform: PlatformMetric[]
  source: 'synced' | 'app'
  publishErrors?: Record<string, string>
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  tiktok: 'TikTok',
  telegram: 'Telegram',
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'scheduled' || status === 'publishing') return 'secondary'
  return 'outline'
}

function PlatformChips({ platforms }: { platforms: string[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span key={p} className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-xs font-medium">
          {PLATFORM_LABELS[p] ?? p}
        </span>
      ))}
    </div>
  )
}

const STAT_ICONS = [
  { key: 'views' as const, icon: Eye, label: 'views' },
  { key: 'likes' as const, icon: Heart, label: 'likes' },
  { key: 'comments' as const, icon: MessageCircle, label: 'comments' },
  { key: 'shares' as const, icon: Share2, label: 'shares' },
]

function StatRow({ metric, label, strong }: { metric: Omit<PlatformMetric, 'platform'>; label: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`text-xs ${strong ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>{label}</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {STAT_ICONS.map(({ key, icon: Icon, label }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={strong ? 'font-bold' : 'font-semibold'}>{metric[key].toLocaleString()}</span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Per-platform key stats plus an overall total across platforms.
function Performance({ perPlatform }: { perPlatform: PlatformMetric[] }) {
  if (perPlatform.length === 0) {
    return (
      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Performance data will appear here once it syncs (refreshes when you log in, and daily).
      </p>
    )
  }
  const total = perPlatform.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      likes: acc.likes + m.likes,
      comments: acc.comments + m.comments,
      shares: acc.shares + m.shares,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 }
  )
  return (
    <div className="mt-3 border-t pt-2">
      {perPlatform.map((m, i) => (
        <StatRow key={`${m.platform}-${i}`} metric={m} label={PLATFORM_LABELS[m.platform] ?? m.platform} />
      ))}
      {perPlatform.length > 1 && (
        <div className="mt-1 border-t pt-1">
          <StatRow metric={total} label="All platforms" strong />
        </div>
      )}
    </div>
  )
}

export function PostPortalTabs({
  scheduled,
  created,
}: {
  scheduled: Post[]
  created: CreatedPost[]
}) {
  const [tab, setTab] = useState<'scheduled' | 'created'>('scheduled')

  const tabs = [
    { key: 'scheduled' as const, label: 'Scheduled', icon: CalendarClock, count: scheduled.length },
    { key: 'created' as const, label: 'Created', icon: CheckCircle2, count: created.length },
  ]

  return (
    <div>
      {/* The switch — top-left, under the title. */}
      <div className="mb-4 inline-flex rounded-full border bg-muted/40 p-1">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="text-xs text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {tab === 'scheduled' ? (
        scheduled.length === 0 ? (
          <div className="pt-6">
            <EmptyState
              icon={Send}
              title="Nothing scheduled"
              description="Drafts and scheduled posts show here with their time and platforms. Create one with the button above."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {scheduled.map((post) => (
              <div key={post.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-1">{post.caption}</p>
                    <PlatformChips platforms={post.platforms ?? []} />
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {post.scheduled_at && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(post.scheduled_at, { withTime: true })}
                      </span>
                    )}
                    <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                    <PublishNowButton postId={post.id} status={post.status as PostStatus} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : created.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={CheckCircle2}
            title="Nothing created yet"
            description="Posts you publish — from Corvelle or straight from the app — land here with a per-platform performance breakdown."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {created.map((post) => (
            <div key={post.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1">{post.caption || '(no caption)'}</p>
                  <PlatformChips platforms={post.platforms} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {post.posted_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(post.posted_at, { withTime: true })}
                    </span>
                  )}
                  <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                </div>
              </div>
              {post.status === 'failed' && post.publishErrors ? (
                <p className="mt-3 border-t pt-3 text-xs text-destructive">
                  {Object.entries(post.publishErrors)
                    .map(([pl, err]) => `${PLATFORM_LABELS[pl] ?? pl}: ${err}`)
                    .join(' · ')}
                </p>
              ) : (
                <Performance perPlatform={post.perPlatform} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
