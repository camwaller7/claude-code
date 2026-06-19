import { inngest } from './client'

export const syncInboxes = inngest.createFunction(
  {
    id: 'sync-inboxes',
    triggers: [
      { event: 'inbox/sync.requested' },
      { cron: '*/15 * * * *' },
    ],
  },
  async ({ step }) => {
    await step.run('sync-gmail', async () => {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/sync`, { method: 'POST' })
    })
    await step.run('sync-x', async () => {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/x/sync`, { method: 'POST' })
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
