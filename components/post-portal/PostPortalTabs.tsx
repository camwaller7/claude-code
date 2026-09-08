'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Send, CheckCircle2, Eye, Heart, MessageCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PublishNowButton } from '@/components/post-portal/PublishNowButton'
import { formatDate } from '@/lib/utils'
import type { Post, PostStatus } from '@/types'

export interface PostMetrics {
  views: number
  likes: number
  comments: number
}

function statusVariant(status: PostStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'scheduled' || status === 'publishing') return 'secondary'
  return 'outline'
}

// Posts that have gone out (or tried to) vs. posts still ahead.
const POSTED_STATUSES = new Set<string>(['published', 'partial', 'failed'])

function PlatformChips({ platforms }: { platforms: string[] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span key={p} className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-xs font-medium capitalize">
          {p}
        </span>
      ))}
    </div>
  )
}

// A compact performance strip for a published post. Metrics come from the daily
// analytics sync, so a just-published post shows a "coming soon" hint instead.
function Performance({ metrics }: { metrics?: PostMetrics }) {
  if (!metrics) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Performance data will appear here once it syncs (updates daily).
      </p>
    )
  }
  const items = [
    { icon: Eye, label: 'views', value: metrics.views },
    { icon: Heart, label: 'likes', value: metrics.likes },
    { icon: MessageCircle, label: 'comments', value: metrics.comments },
  ]
  return (
    <div className="mt-2 flex flex-wrap gap-4">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">{value.toLocaleString()}</span>
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function PostPortalTabs({
  posts,
  metricsById,
}: {
  posts: Post[]
  metricsById: Record<string, PostMetrics>
}) {
  const [tab, setTab] = useState<'scheduled' | 'posted'>('scheduled')

  const scheduled = posts.filter((p) => !POSTED_STATUSES.has(p.status as string))
  const posted = posts.filter((p) => POSTED_STATUSES.has(p.status as string))
  const list = tab === 'scheduled' ? scheduled : posted

  // Aggregate metrics for a post across whatever platform post ids it carries.
  function metricsFor(post: Post): PostMetrics | undefined {
    const ids = post.platform_post_ids ? Object.values(post.platform_post_ids) : []
    let hit = false
    const total: PostMetrics = { views: 0, likes: 0, comments: 0 }
    for (const id of ids) {
      const m = id ? metricsById[id as string] : undefined
      if (m) {
        hit = true
        total.views += m.views
        total.likes += m.likes
        total.comments += m.comments
      }
    }
    return hit ? total : undefined
  }

  return (
    <div>
      {/* Tab switcher */}
      <div className="mb-4 inline-flex rounded-lg border bg-muted/40 p-0.5">
        {(['scheduled', 'posted'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {t === 'scheduled' ? scheduled.length : posted.length}
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={tab === 'scheduled' ? Send : CheckCircle2}
            title={tab === 'scheduled' ? 'Nothing scheduled' : 'Nothing posted yet'}
            description={
              tab === 'scheduled'
                ? 'Drafts and scheduled posts show here. Create one with the button above.'
                : 'Once a post publishes it moves here, with a quick performance summary.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((post) => (
            <div key={post.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1">{post.caption}</p>
                  <PlatformChips platforms={post.platforms ?? []} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {tab === 'posted' && post.published_at
                      ? formatDate(post.published_at, { withTime: true })
                      : post.scheduled_at
                        ? formatDate(post.scheduled_at, { withTime: true })
                        : null}
                  </span>
                  <Badge variant={statusVariant(post.status as PostStatus)}>{post.status}</Badge>
                  {tab === 'scheduled' && (
                    <PublishNowButton postId={post.id} status={post.status as PostStatus} />
                  )}
                </div>
              </div>
              {tab === 'posted' && post.status === 'published' && (
                <Performance metrics={metricsFor(post)} />
              )}
              {tab === 'posted' && post.status === 'failed' && post.publish_errors && (
                <p className="mt-2 text-xs text-destructive">
                  {Object.entries(post.publish_errors as Record<string, string>)
                    .map(([pl, err]) => `${pl}: ${err}`)
                    .join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
