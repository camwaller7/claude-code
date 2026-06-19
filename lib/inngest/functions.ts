import { inngest } from './client'
import { getAdminClient } from '@/lib/supabase/admin'

export const syncInboxes = inngest.createFunction(
  {
    id: 'sync-inboxes',
    triggers: [{ event: 'inbox/sync.requested' }],
  },
  async ({ event, step }) => {
    await step.run('log-sync', async () => {
      console.log('Syncing inboxes', event.data)
    })
    // Platform-specific sync handlers will be added here per integration
  }
)

export const publishPost = inngest.createFunction(
  {
    id: 'publish-post',
    retries: 3,
    triggers: [{ event: 'post/publish.scheduled' }],
  },
  async ({ event, step }) => {
    const postId = event.data.postId as string

    await step.run('mark-publishing', async () => {
      await getAdminClient()
        .from('posts')
        .update({ status: 'publishing' })
        .eq('id', postId)
    })

    // Per-platform publish calls will be added here
    await step.run('log-publish', async () => {
      console.log('Publishing post', postId)
    })

    await step.run('mark-published', async () => {
      await getAdminClient()
        .from('posts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', postId)
    })
  }
)
