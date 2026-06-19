import { inngest } from './client'

export const syncInboxes = inngest.createFunction(
  {
    id: 'sync-inboxes',
    triggers: [{ event: 'inbox/sync.requested' }],
  },
  async ({ event, step }) => {
    await step.run('sync-all-platforms', async () => {
      console.log('syncing inboxes')
    })
  }
)

export const publishPost = inngest.createFunction(
  {
    id: 'publish-post',
    triggers: [{ event: 'post/publish.scheduled' }],
  },
  async ({ event, step }) => {
    await step.run('publish-to-platforms', async () => {
      console.log(`publishing post ${event.data.postId}`)
    })
  }
)
