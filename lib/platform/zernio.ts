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

// ─── Inbox history (backfill) ─────────────────────────────────────────────────
// Unlike the webhook (which only delivers events from the moment it's wired),
// these endpoints return the FULL conversation + message history Zernio holds,
// so we can backfill everything a creator had before connecting — nothing gets
// missed. Both are paginated with an opaque cursor.

// zernioFetch unwraps a top-level { data } envelope, which would drop the
// sibling `pagination` block the inbox-list endpoint returns. This variant
// returns the parsed body verbatim so callers see both `data` and `pagination`.
async function zernioFetchRaw<T>(path: string): Promise<ZernioResult<T>> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) return { ok: false, status: 0, error: 'ZERNIO_API_KEY not set' }
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  })
  const raw = await res.text()
  let parsed: unknown = undefined
  try { parsed = raw ? JSON.parse(raw) : undefined } catch { /* non-JSON */ }
  if (!res.ok) {
    const errMsg = (parsed as { error?: string })?.error ?? `Zernio API returned ${res.status}`
    return { ok: false, status: res.status, error: errMsg }
  }
  return { ok: true, status: res.status, data: parsed as T }
}

export interface ZernioInboxConversation {
  id?: string
  platform?: string
  accountId?: string
  accountUsername?: string
  participantId?: string
  participantName?: string
  lastMessage?: string
  updatedTime?: string
  status?: 'active' | 'archived'
}

export interface ZernioInboxAttachment {
  type?: string
  originalType?: string
  url?: string
  // IG/FB `url` is a signed Meta CDN link that EXPIRES. `refreshUrl` (a zernio.com
  // endpoint) re-mints it on every request and is safe to store — always prefer it.
  refreshUrl?: string | null
}

export interface ZernioInboxMessage {
  id?: string
  conversationId?: string
  accountId?: string
  platform?: string
  message?: string
  senderName?: string | null
  direction?: 'incoming' | 'outgoing'
  createdAt?: string
  attachments?: ZernioInboxAttachment[]
}

interface Paginated<T> {
  data?: T[]
  messages?: T[]
  pagination?: { hasMore?: boolean; nextCursor?: string | null }
}

// One page of conversations. Pass accountId to scope to a single connected
// account — required so multi-user backfill stays partitioned per creator.
export function listInboxConversations(opts: { accountId?: string; cursor?: string; limit?: number; sortOrder?: 'asc' | 'desc' }) {
  const q = new URLSearchParams()
  if (opts.accountId) q.set('accountId', opts.accountId)
  if (opts.cursor) q.set('cursor', opts.cursor)
  q.set('limit', String(opts.limit ?? 100))
  // Newest-updated first so a bounded backfill can stop once it crosses the
  // date cutoff instead of walking all history.
  q.set('sortOrder', opts.sortOrder ?? 'desc')
  return zernioFetchRaw<Paginated<ZernioInboxConversation>>(`/v1/inbox/conversations?${q.toString()}`)
}

// One page of messages for a conversation. accountId is required by Zernio.
// Defaults to newest-first so a date-bounded backfill can stop early.
export function getInboxMessages(conversationId: string, accountId: string, opts?: { cursor?: string; limit?: number; sortOrder?: 'asc' | 'desc' }) {
  const q = new URLSearchParams({ accountId })
  if (opts?.cursor) q.set('cursor', opts.cursor)
  q.set('limit', String(opts?.limit ?? 100))
  q.set('sortOrder', opts?.sortOrder ?? 'desc')
  return zernioFetchRaw<Paginated<ZernioInboxMessage>>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${q.toString()}`
  )
}

// The origin of the Zernio API (e.g. https://zernio.com), for absolutising a
// relative refreshUrl. The /api/media proxy only accepts zernio.com hosts.
function zernioOrigin(): string {
  try { return new URL(ZERNIO_BASE).origin } catch { return 'https://zernio.com' }
}

// The URL to STORE for an attachment. Prefer the durable refreshUrl (re-minted
// server-side, routed through /api/media) over the expiring signed CDN url.
export function attachmentStoreUrl(a: ZernioInboxAttachment): string {
  const r = a.refreshUrl
  if (r) return r.startsWith('http') ? r : `${zernioOrigin()}${r}`
  return a.url ?? ''
}

// Webhook attachments carry NO refreshUrl — Zernio documents that it must be
// built from the resolve endpoint. conversationId + messageId + the attachment's
// zero-based index + the receiving accountId reconstruct a durable, re-mintable
// url on zernio.com (so it survives the Meta CDN signature expiring).
export function buildAttachmentRefreshUrl(
  conversationId: string,
  messageId: string,
  index: number,
  accountId: string
): string {
  const q = new URLSearchParams({ accountId })
  return `${ZERNIO_BASE}/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments/${index}?${q.toString()}`
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

// Zernio's create-post response. On a full success (201) the body is
// { post: { _id, status, ... } }; on a partial/failed inline publish (207) it
// also carries platformResults[] with a per-platform status + error. The post's
// own _id is what analytics (content_metrics.external_post_id) is keyed on.
export interface ZernioPlatformResult {
  platform?: string // Zernio platform name, matches post.platforms[].platform
  status?: string // pending | processing | published | failed | cancelled | uploading
  error?: string | null
}
export interface ZernioCreatePostResponse {
  message?: string
  error?: string
  post?: {
    _id?: string
    status?: string
  }
  platformResults?: ZernioPlatformResult[]
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

// ─── Account reach (account-level insights) ───────────────────────────────────
// Reach = how many unique people saw the account/its content over a window.
// Instagram exposes a true `reach` metric; Facebook's closest post-Nov-2025
// metric is `page_media_view` (Meta removed unique Page reach). Both come from
// the per-platform account-insights endpoints. Requires the account's Zernio
// analytics add-on; returns null (not 0) when unavailable so the UI can tell
// "no data" from "zero reach".

interface ZernioAccountInsights {
  metrics?: Record<string, { total?: number }>
}

// Fetch total reach for one account over [since, until] (YYYY-MM-DD). Returns
// null for platforms we don't map or when the metric isn't available.
export async function getAccountReach(
  platform: string,
  accountId: string,
  since: string,
  until: string
): Promise<number | null> {
  let path: string
  let metric: string
  if (platform === 'instagram') {
    path = '/v1/analytics/instagram/account-insights'
    metric = 'reach'
  } else if (platform === 'facebook') {
    path = '/v1/analytics/facebook/page-insights'
    metric = 'page_media_view'
  } else {
    return null
  }
  const q = new URLSearchParams({ accountId, metrics: metric, metricType: 'total_value', since, until })
  const res = await zernioFetch<ZernioAccountInsights>(`${path}?${q.toString()}`)
  if (!res.ok || !res.data) return null
  const total = res.data.metrics?.[metric]?.total
  return typeof total === 'number' ? total : null
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
