import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncInboxes, publishPost, syncAnalytics } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncInboxes, publishPost, syncAnalytics],
})
