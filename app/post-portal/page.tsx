export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { currentUserHasFeature } from '@/lib/billing/features'
import { postPortalEnabled } from '@/lib/flags'
import { UpgradeNotice } from '@/components/billing/UpgradeNotice'
import { EmptyState } from '@/components/ui/EmptyState'
import { Send } from 'lucide-react'
import { NewPostDialog } from '@/components/post-portal/NewPostDialog'
import { PostPortalTabs, type CreatedPost, type PlatformMetric } from '@/components/post-portal/PostPortalTabs'
import type { Post } from '@/types'

const SCHEDULED_STATUSES = new Set(['draft', 'scheduled', 'publishing'])

export default async function PostPortalPage() {
  await requireAuth()
  // Master switch: publishing can be hidden entirely (kept out of the nav too).
  if (!postPortalEnabled()) redirect('/dashboard')
  // When enabled, it's a Growth/Pro feature — never Starter.
  if (!(await currentUserHasFeature('postPortal'))) {
    return <UpgradeNotice feature="Post portal" />
  }

  const supabase = await createServerClient()
  const uid = await scopedUserId()

  // Corvelle's own posts (drafts, scheduled, and its publish records).
  let postsQuery = supabase.from('posts').select('*').order('scheduled_at', { ascending: false })
  if (uid) postsQuery = postsQuery.eq('user_id', uid)
  const { data: posts } = await postsQuery
  const allPosts = (posts ?? []) as Post[]

  // Every published post on the connected accounts — whether posted from Corvelle
  // OR natively from the platform's own app — flows into content_metrics via the
  // Zernio analytics sync. Group those rows (one per platform) by the external
  // post id to build the "Created" list, with per-platform stats.
  let cmQuery = supabase
    .from('content_metrics')
    .select('external_post_id, platform, caption, media_type, views, likes, comments, shares, posted_at')
    .order('posted_at', { ascending: false })
    .limit(200)
  if (uid) cmQuery = cmQuery.eq('user_id', uid)
  const { data: metrics } = await cmQuery

  const grouped = new Map<string, CreatedPost>()
  for (const m of metrics ?? []) {
    const id = m.external_post_id as string
    if (!id) continue
    const stat: PlatformMetric = {
      platform: (m.platform as string) ?? 'unknown',
      views: (m.views as number) ?? 0,
      likes: (m.likes as number) ?? 0,
      comments: (m.comments as number) ?? 0,
      shares: (m.shares as number) ?? 0,
    }
    const existing = grouped.get(id)
    if (existing) {
      if (!existing.platforms.includes(stat.platform)) existing.platforms.push(stat.platform)
      existing.perPlatform.push(stat)
    } else {
      grouped.set(id, {
        id,
        caption: (m.caption as string) ?? '',
        platforms: [stat.platform],
        posted_at: (m.posted_at as string) ?? null,
        status: 'published',
        perPlatform: [stat],
        source: 'synced',
      })
    }
  }

  // Which external ids are already represented by synced metrics, so a Corvelle
  // post that has synced isn't listed twice.
  const syncedIds = new Set(grouped.keys())

  // Corvelle posts that have published (or failed) but haven't shown up in
  // content_metrics yet (just sent, still processing, or failed) — surface them
  // so nothing is missing between publish and the next analytics sync.
  for (const p of allPosts) {
    if (p.status !== 'published' && p.status !== 'failed' && p.status !== 'partial') continue
    const ids = p.platform_post_ids ? Object.values(p.platform_post_ids) : []
    if (ids.some((id) => syncedIds.has(id as string))) continue
    grouped.set(`post:${p.id}`, {
      id: `post:${p.id}`,
      caption: p.caption,
      platforms: p.platforms ?? [],
      posted_at: p.published_at,
      status: p.status,
      perPlatform: [],
      source: 'app',
      publishErrors: p.publish_errors ?? undefined,
    })
  }

  const created = Array.from(grouped.values()).sort((a, b) =>
    (b.posted_at ?? '').localeCompare(a.posted_at ?? '')
  )
  const scheduled = allPosts.filter((p) => SCHEDULED_STATUSES.has(p.status as string))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post Portal</h1>
          <p className="text-sm text-muted-foreground">Plan it, schedule it, publish it.</p>
        </div>
        <NewPostDialog />
      </div>
      {scheduled.length === 0 && created.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={Send}
            title="No posts yet"
            description="Draft once, publish everywhere. Start your first post above."
          />
        </div>
      ) : (
        <PostPortalTabs scheduled={scheduled} created={created} />
      )}
    </div>
  )
}
