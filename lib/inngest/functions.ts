import { inngest } from './client'
import { adminSupabase } from '@/lib/supabase/admin'
import { getValidToken, getValidMetaToken } from '@/lib/platform/tokens'
import { META_GRAPH_VERSION, THREADS_GRAPH_VERSION } from '@/lib/platform/metaVersion'
import type { Platform } from '@/types'

// ─── Inbox sync (runs every 15 min) ──────────────────────────────────────────

// Inbound messaging is push-based via the Zernio webhook (/api/webhooks/zernio),
// so there is no polling inbox sync. The legacy Gmail/X polling was retired with
// the direct-OAuth integrations.

// ─── Post publishing ──────────────────────────────────────────────────────────

interface PublishResult {
  platform: Platform
  success: boolean
  postId?: string
  error?: string
}

async function publishToInstagram(
  caption: string,
  mediaUrl: string | null,
  token: string,
  igAccountId: string
): Promise<string> {
  if (!mediaUrl) throw new Error('Instagram requires media')

  const containerRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: mediaUrl, caption, access_token: token }),
    }
  )
  const container = await containerRes.json() as { id?: string; error?: { message: string } }
  if (!container.id) throw new Error(container.error?.message ?? 'No container id')

  const publishRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${igAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    }
  )
  const published = await publishRes.json() as { id?: string; error?: { message: string } }
  if (!published.id) throw new Error(published.error?.message ?? 'No post id')
  return published.id
}

async function publishToFacebook(
  caption: string,
  mediaUrl: string | null,
  token: string,
  pageId: string
): Promise<string> {
  const endpoint = mediaUrl
    ? `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos`
    : `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`

  const payload: Record<string, string> = { access_token: token }
  if (mediaUrl) {
    payload.url = mediaUrl
    payload.caption = caption
  } else {
    payload.message = caption
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } }
  const id = data.post_id ?? data.id
  if (!id) throw new Error(data.error?.message ?? 'No post id')
  return id
}

async function publishToX(caption: string, token: string): Promise<string> {
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: caption.slice(0, 280) }),
  })
  const data = await res.json() as { data?: { id: string }; errors?: { message: string }[] }
  if (!data.data?.id) throw new Error(data.errors?.[0]?.message ?? 'No tweet id')
  return data.data.id
}

async function publishToThreads(
  caption: string,
  mediaUrl: string | null,
  token: string,
  threadsUserId: string
): Promise<string> {
  const containerPayload: Record<string, string> = {
    media_type: mediaUrl ? 'IMAGE' : 'TEXT',
    text: caption,
    access_token: token,
  }
  if (mediaUrl) containerPayload.image_url = mediaUrl

  const containerRes = await fetch(
    `https://graph.threads.net/${THREADS_GRAPH_VERSION}/${threadsUserId}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerPayload),
    }
  )
  const container = await containerRes.json() as { id?: string; error?: { message: string } }
  if (!container.id) throw new Error(container.error?.message ?? 'No container id')

  const publishRes = await fetch(
    `https://graph.threads.net/${THREADS_GRAPH_VERSION}/${threadsUserId}/threads_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    }
  )
  const published = await publishRes.json() as { id?: string; error?: { message: string } }
  if (!published.id) throw new Error(published.error?.message ?? 'No post id')
  return published.id
}

export const publishPost = inngest.createFunction(
  {
    id: 'publish-post',
    triggers: [{ event: 'post/publish.scheduled' }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { postId, scheduledAt } = event.data as { postId: string; scheduledAt: string }

    // Wait until the scheduled publish time — without this, posts publish immediately
    if (scheduledAt && new Date(scheduledAt).getTime() > Date.now()) {
      await step.sleepUntil('wait-for-scheduled-time', new Date(scheduledAt))
    }

    const post = await step.run('fetch-post', async () => {
      const { data, error } = await adminSupabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single()
      if (error || !data) throw new Error(`Post ${postId} not found`)
      return data
    })

    await step.run('mark-publishing', async () => {
      await adminSupabase.from('posts').update({ status: 'publishing' }).eq('id', postId)
    })

    const results: PublishResult[] = await step.run('publish-to-platforms', async () => {
      const platforms = post.platforms as Platform[]
      const caption = post.caption as string
      const hashtags = (post.hashtags as string) || ''
      const mediaUrl = post.media_url as string | null
      const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption

      const output: PublishResult[] = []

      for (const platform of platforms) {
        try {
          if (platform === 'instagram') {
            const { data: conn } = await adminSupabase
              .from('platform_connections')
              .select('access_token, account_id')
              .eq('platform', 'instagram')
              .limit(1)
              .single()
            if (!conn) throw new Error('No Instagram connection')
            const token = await getValidMetaToken('instagram', conn.account_id as string)
            const id = await publishToInstagram(
              fullCaption, mediaUrl,
              token, conn.account_id as string
            )
            output.push({ platform, success: true, postId: id })

          } else if (platform === 'facebook') {
            const { data: conn } = await adminSupabase
              .from('platform_connections')
              .select('access_token, account_id')
              .eq('platform', 'facebook')
              .limit(1)
              .single()
            if (!conn) throw new Error('No Facebook connection')
            const token = await getValidMetaToken('facebook', conn.account_id as string)
            const id = await publishToFacebook(
              fullCaption, mediaUrl,
              token, conn.account_id as string
            )
            output.push({ platform, success: true, postId: id })

          } else if (platform === 'x') {
            const token = await getValidToken('x')
            const id = await publishToX(fullCaption, token)
            output.push({ platform, success: true, postId: id })

          } else if (platform === 'threads') {
            const { data: conn } = await adminSupabase
              .from('platform_connections')
              .select('access_token, account_id')
              .eq('platform', 'threads')
              .limit(1)
              .single()
            if (!conn) throw new Error('No Threads connection')
            const threadsToken = await getValidMetaToken('threads', conn.account_id as string)
            const id = await publishToThreads(
              fullCaption, mediaUrl,
              threadsToken, conn.account_id as string
            )
            output.push({ platform, success: true, postId: id })

          } else if (platform === 'tiktok') {
            output.push({
              platform,
              success: false,
              error: 'TikTok requires TIKTOK_PROVIDER_API_KEY — not yet wired',
            })
          }
        } catch (err) {
          output.push({
            platform,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return output
    })

    await step.run('update-post-status', async () => {
      const anySuccess = results.some((r) => r.success)
      const allFailed = results.every((r) => !r.success)

      const platformPostIds: Record<string, string> = {}
      const platformErrors: Record<string, string> = {}
      for (const r of results) {
        if (r.success && r.postId) platformPostIds[r.platform] = r.postId
        if (!r.success && r.error) platformErrors[r.platform] = r.error
      }

      await adminSupabase
        .from('posts')
        .update({
          status: allFailed ? 'failed' : 'published',
          published_at: anySuccess ? new Date().toISOString() : null,
          platform_post_ids: Object.keys(platformPostIds).length > 0 ? platformPostIds : null,
          publish_errors: Object.keys(platformErrors).length > 0 ? platformErrors : null,
        })
        .eq('id', postId)

      if (Object.keys(platformErrors).length > 0) {
        console.error(`[publishPost] post ${postId} had platform failures:`, platformErrors)
      }
      if (allFailed) {
        console.error(`[publishPost] post ${postId} failed on every platform`)
      }
    })

    return { results }
  }
)


// ─── Analytics sync (runs daily) ──────────────────────────────────────────────
// Snapshots follower counts + refreshes per-post insights so the Audience
// dashboard reflects real growth instead of demo data.

export const syncAnalytics = inngest.createFunction(
  {
    id: 'sync-analytics',
    triggers: [
      { event: 'analytics/sync.requested' },
      { cron: '0 6 * * *' },
    ],
    retries: 3,
  },
  async ({ step }) => {
    // Zernio is the active analytics provider (IG/FB are connected through it).
    // The route no-ops when Zernio is disabled, so it's always safe to call.
    await step.run('sync-zernio-insights', async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/zernio/insights`, { method: 'POST', headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '' } })
      if (!res.ok) throw new Error(`Zernio insights sync failed: ${res.status} ${await res.text().catch(() => '')}`)
    })

  }
)
