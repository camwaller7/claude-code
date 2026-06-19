import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { NewPostButton } from '@/components/post-portal/NewPostButton'
import type { Post } from '@/types'

const statusColor: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  publishing: 'secondary',
  published: 'default',
  failed: 'destructive',
}

export default async function PostPortalPage() {
  const supabase = await createServerClient()
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .order('scheduled_at', { ascending: false, nullsFirst: false })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold">Post Portal</h1>
        <NewPostButton />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {!posts?.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
            <p className="text-sm">No posts yet</p>
            <p className="text-xs mt-1">Schedule your first post to get started</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {(posts as Post[]).map((post) => (
              <li key={post.id} className="flex items-start gap-4 rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800 line-clamp-2">{post.caption || '(no caption)'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.platforms.map((p) => (
                      <span key={p} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant={statusColor[post.status] ?? 'outline'}>{post.status}</Badge>
                  {post.scheduled_at && (
                    <span className="text-xs text-zinc-400">
                      {new Date(post.scheduled_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
