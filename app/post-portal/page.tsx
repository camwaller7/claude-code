export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { currentUserHasFeature } from '@/lib/billing/features'
import { postPortalEnabled } from '@/lib/flags'
import { UpgradeNotice } from '@/components/billing/UpgradeNotice'
import { Badge } from '@/components/ui/badge'
import { Send } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewPostDialog } from '@/components/post-portal/NewPostDialog'
import { PublishConnect } from '@/components/post-portal/PublishConnect'
import { PublishNowButton } from '@/components/post-portal/PublishNowButton'
import { formatDate } from '@/lib/utils'
import type { Post, PostStatus } from '@/types'

function statusVariant(status: PostStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'scheduled' || status === 'publishing') return 'secondary'
  return 'outline'
}

export default async function PostPortalPage() {
  await requireAuth()
  // Master switch: publishing is hidden for the trial (kept out of the nav too).
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post Portal</h1>
          <p className="text-sm text-muted-foreground">Schedule and manage your content</p>
        </div>
        <NewPostDialog />
      </div>
      <PublishConnect />
      {!posts || posts.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={Send}
            title="No posts yet"
            description="Draft, schedule, and auto-publish content to your connected platforms. Create your first post with the button above."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post: Post) => (
            <div key={post.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-1">{post.caption}</p>
                <div className="mt-1 flex gap-1">
                  {(post.platforms ?? []).map((p: string) => (
                    <span key={p} className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-xs font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {post.scheduled_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(post.scheduled_at, { withTime: true })}
                  </span>
                )}
                <Badge variant={statusVariant(post.status as PostStatus)}>{post.status}</Badge>
                <PublishNowButton postId={post.id} status={post.status as PostStatus} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
