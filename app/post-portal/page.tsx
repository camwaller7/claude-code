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
import { PostPortalTabs, type PostMetrics } from '@/components/post-portal/PostPortalTabs'
import type { Post } from '@/types'

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

  let postsQuery = supabase.from('posts').select('*').order('scheduled_at', { ascending: false })
  if (uid) postsQuery = postsQuery.eq('user_id', uid)
  const { data: posts } = await postsQuery
  const allPosts = (posts ?? []) as Post[]

  // Pull performance for published posts. Each post stores the Zernio post id in
  // platform_post_ids; content_metrics (from the daily analytics sync) is keyed
  // by that same external id, so we can join. Metrics are aggregated per id.
  const metricsById: Record<string, PostMetrics> = {}
  const postIds = Array.from(
    new Set(
      allPosts
        .filter((p) => p.status === 'published' && p.platform_post_ids)
        .flatMap((p) => Object.values(p.platform_post_ids ?? {}))
        .filter(Boolean) as string[]
    )
  )
  if (postIds.length > 0) {
    let metricsQuery = supabase
      .from('content_metrics')
      .select('external_post_id, views, likes, comments')
      .in('external_post_id', postIds)
    if (uid) metricsQuery = metricsQuery.eq('user_id', uid)
    const { data: metrics } = await metricsQuery
    for (const m of metrics ?? []) {
      const id = m.external_post_id as string
      const agg = metricsById[id] ?? { views: 0, likes: 0, comments: 0 }
      agg.views += (m.views as number) ?? 0
      agg.likes += (m.likes as number) ?? 0
      agg.comments += (m.comments as number) ?? 0
      metricsById[id] = agg
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post Portal</h1>
          <p className="text-sm text-muted-foreground">Schedule and manage your content</p>
        </div>
        <NewPostDialog />
      </div>
      {allPosts.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={Send}
            title="No posts yet"
            description="Draft, schedule, and auto-publish content to your connected platforms. Create your first post with the button above."
          />
        </div>
      ) : (
        <PostPortalTabs posts={allPosts} metricsById={metricsById} />
      )}
    </div>
  )
}
