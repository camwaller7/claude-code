export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { Badge } from '@/components/ui/badge'
import { NewPostDialog } from '@/components/post-portal/NewPostDialog'
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
      {!posts || posts.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No posts yet. Create your first post!</p>
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
