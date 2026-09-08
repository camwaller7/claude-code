// Zernio unified social API client (https://zernio.com).
//
// Zernio is an approved Meta Marketing Partner: accounts connect through
// Zernio's own reviewed Meta app, so this path does NOT require our own Meta
// App Review, token management, or webhook wiring. We use it (behind the
// ZERNIO_ENABLED flag) as the messaging provider for Instagram/Facebook DMs,
// while the direct Meta integration stays in place as a fallback.
//
// Docs mirrored from the official @zernio/node SDK surface (v0.2.x):
//   Base:    https://zernio.com/api
//   Auth:    Authorization: Bearer <ZERNIO_API_KEY>
//   Inbox:   GET  /v1/inbox/conversations
//            GET  /v1/inbox/conversations/{id}/messages
//            POST /v1/inbox/conversations/{id}/messages   (send)
//   Accounts:GET  /v1/accounts
//   Connect: POST /v1/connect/{platform}                  (hosted OAuth URL)
//   Webhooks:POST /v1/webhooks/settings

const ZERNIO_BASE = process.env.ZERNIO_BASE_URL ?? 'https://zernio.com/api'

export function zernioEnabled(): boolean {
  return process.env.ZERNIO_ENABLED === 'true' && Boolean(process.env.ZERNIO_API_KEY)
}

export type ZernioPlatform = 'instagram' | 'facebook' | 'telegram' | 'whatsapp' | 'sms'

interface ZernioResult<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

async function zernioFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<ZernioResult<T>> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) return { ok: false, status: 0, error: 'ZERNIO_API_KEY not set' }

  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  })

  const raw = await res.text()
  let parsed: unknown = undefined
  try {
    parsed = raw ? JSON.parse(raw) : undefined
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const errMsg =
      (parsed as { error?: string })?.error ?? `Zernio API returned ${res.status}`
    return { ok: false, status: res.status, error: errMsg }
  }
  // Zernio wraps successful bodies as { data: ... } in most endpoints.
  const data = (parsed as { data?: T })?.data ?? (parsed as T)
  return { ok: true, status: res.status, data }
}

export interface ZernioAccount {
  // Zernio returns Mongo documents keyed by `_id`; some responses also mirror
  // it as `id`. Accept either so the sending-account lookup is robust.
  _id?: string
  id?: string
  platform: ZernioPlatform | string
  username?: string
  name?: string
  displayName?: string
  // Zernio profile (workspace) id this account belongs to.
  profileId?: string
}

// The id of an account, whichever key Zernio used on this response.
export function zernioAccountId(a: ZernioAccount): string | undefined {
  return a._id ?? a.id
}

// List the social accounts connected to this Zernio workspace.
export function listZernioAccounts() {
  return zernioFetch<{ accounts?: ZernioAccount[] } | ZernioAccount[]>('/v1/accounts')
}

// The Zernio profile (workspace) id that connected accounts live under. In our
// shared-workspace model every app user connects into the same Zernio profile,
// so this is a single constant: taken from ZERNIO_PROFILE_ID, else derived from
// any already-connected account's profileId.
export async function getZernioProfileId(): Promise<string | undefined> {
  const fromEnv = process.env.ZERNIO_PROFILE_ID
  if (fromEnv) return fromEnv
  const res = await listZernioAccounts()
  if (!res.ok || !res.data) return undefined
  const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []
  return accounts.map(a => a.profileId).find(Boolean)
}

// Generate a hosted OAuth URL to connect a platform via Zernio. The connect
// endpoint is GET /v1/connect/{platform}?profileId=…&redirect_url=… and returns
// { authUrl } to send the user to. On completion Zernio redirects to
// redirectUrl with connected/platform/profileId/accountId/username appended.
export async function getZernioConnectUrl(platform: ZernioPlatform, redirectUrl: string) {
  const profileId = await getZernioProfileId()
  if (!profileId) {
    return { ok: false as const, status: 0, error: 'No Zernio profileId available (set ZERNIO_PROFILE_ID).' }
  }
  const q = new URLSearchParams({ profileId, redirect_url: redirectUrl })
  return zernioFetch<{ authUrl?: string; state?: string }>(`/v1/connect/${platform}?${q.toString()}`)
}

// Resolve the Zernio social-account id for a platform. This is a single-creator
// app with one connected account per platform, so the first match wins. Zernio's
// send endpoint requires `accountId` (the sending account) even though the
// conversation already implies it.
export async function resolveZernioAccountId(platform: string): Promise<string | undefined> {
  const res = await listZernioAccounts()
  if (!res.ok || !res.data) return undefined
  const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []
  // Zernio reports X as "twitter"; match either label for our "x".
  const aliases = platform === 'x' ? ['x', 'twitter'] : [platform]
  const match = accounts.find((a) => aliases.includes(String(a.platform)))
  return match ? zernioAccountId(match) : undefined
}

// Send a DM reply into an existing Zernio conversation. Zernio's send schema
// requires `accountId` (the sending social account) as a required string, plus
// the optional `message` text — omitting accountId is what returned the
// "expected string, received undefined" validation error.
export function sendZernioMessage(conversationId: string, accountId: string, message: string) {
  return zernioFetch<{ id: string }>(
    `/v1/inbox/conversations/${conversationId}/messages`,
    { method: 'POST', body: { accountId, message } }
  )
}

// ─── Publishing ───────────────────────────────────────────────────────────────
// Zernio's Posts API publishes to the same connected accounts we already use for
// the inbox (POST /v1/posts). This is what powers the post portal — no separate
// publishing provider or connection is needed. accountId is the Zernio account
// _id we store in zernio_accounts.zernio_account_id.

// Map our internal platform slugs to Zernio's platform names (Zernio calls X
// "twitter"; the rest match). Used for the `platform` field of each target.
const ZERNIO_PLATFORM_NAMES: Record<string, string> = {
  x: 'twitter',
  instagram: 'instagram',
  facebook: 'facebook',
  threads: 'threads',
  tiktok: 'tiktok',
  telegram: 'telegram',
}
export function toZernioPlatformName(p: string): string {
  return ZERNIO_PLATFORM_NAMES[p] ?? p
}

export interface ZernioPublishTarget {
  platform: string // Zernio platform name (see toZernioPlatformName)
  accountId: string
}

// One entry per platform in Zernio's create-post response.
export interface ZernioPostResult {
  platform?: string
  accountId?: string
  status?: string
  platformPostUrl?: string
  postId?: string
  id?: string
  error?: string
  success?: boolean
}
export interface ZernioCreatePostResponse {
  id?: string
  results?: ZernioPostResult[]
  platforms?: ZernioPostResult[]
}

// Publish (or schedule) a post to one or more connected accounts. Pass
// `scheduledFor` (ISO 8601) to schedule, or omit it to publish immediately.
// Hashtags are NOT auto-appended by Zernio, so `content` must already include
// them (the post portal merges caption + hashtags before calling this).
export function publishToZernio(opts: {
  content: string
  targets: ZernioPublishTarget[]
  mediaUrls?: string[]
  scheduledFor?: string
}) {
  const body: Record<string, unknown> = {
    content: opts.content,
    platforms: opts.targets.map((t) => ({ platform: t.platform, accountId: t.accountId })),
  }
  if (opts.mediaUrls && opts.mediaUrls.length > 0) {
    body.mediaItems = opts.mediaUrls.map((url) => ({ url }))
  }
  if (opts.scheduledFor) body.scheduledFor = opts.scheduledFor
  else body.publishNow = true
  return zernioFetch<ZernioCreatePostResponse>('/v1/posts', { method: 'POST', body })
}

// ─── Analytics ──────────────────────────────────────────────────────────────
// Zernio's unified analytics endpoint returns published-post metrics plus the
// connected accounts' follower counts, replacing the direct Meta Graph insights
// pull. followersCount / analytics require the account's Zernio analytics add-on
// (hasAnalyticsAccess reports whether it's enabled).

export interface ZernioPostAnalytics {
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  views?: number
  clicks?: number
  follows?: number | null
}

export interface ZernioAnalyticsPost {
  _id?: string
  content?: string
  publishedAt?: string
  status?: string
  platform?: string
  platformPostUrl?: string
  mediaType?: string
  mediaProductType?: string
  analytics?: ZernioPostAnalytics
}

export interface ZernioAnalyticsAccount {
  _id?: string
  platform?: string
  username?: string
  followersCount?: number
}

export interface ZernioAnalyticsResponse {
  posts?: ZernioAnalyticsPost[]
  accounts?: ZernioAnalyticsAccount[]
  hasAnalyticsAccess?: boolean
}

// Fetch published-post analytics and connected-account follower counts.
// Pass accountId to scope to a single connected account (used by the per-user
// sync so each creator only gets their own account's metrics).
export function getZernioAnalytics(params?: { limit?: number; platform?: string; accountId?: string }) {
  const q = new URLSearchParams()
  q.set('limit', String(params?.limit ?? 100))
  q.set('order', 'desc')
  if (params?.platform) q.set('platform', params.platform)
  if (params?.accountId) q.set('accountId', params.accountId)
  return zernioFetch<ZernioAnalyticsResponse>(`/v1/analytics?${q.toString()}`)
}

// Register (or update) the webhook Zernio calls on inbound events.
export function configureZernioWebhook(url: string, secret: string) {
  return zernioFetch<{ id: string }>('/v1/webhooks/settings', {
    method: 'POST',
    body: {
      name: 'Creator PA inbox',
      url,
      secret,
      // message.sent captures replies the creator sends from the native app
      // (e.g. the Instagram app on their phone) so the full thread shows.
      events: ['message.received', 'message.sent', 'conversation.started'],
    },
  })
}
