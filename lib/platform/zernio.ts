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
  id: string
  platform: ZernioPlatform | string
  username?: string
  name?: string
}

// List the social accounts connected to this Zernio workspace.
export function listZernioAccounts() {
  return zernioFetch<{ accounts?: ZernioAccount[] } | ZernioAccount[]>('/v1/accounts')
}

// Generate a hosted OAuth URL for the owner to connect a platform via Zernio.
export function getZernioConnectUrl(platform: ZernioPlatform, redirectUrl?: string) {
  return zernioFetch<{ url: string }>(`/v1/connect/${platform}`, {
    method: 'POST',
    body: redirectUrl ? { redirectUrl } : {},
  })
}

// Resolve the Zernio social-account id for a platform. This is a single-creator
// app with one connected account per platform, so the first match wins. Zernio's
// send endpoint requires `accountId` (the sending account) even though the
// conversation already implies it.
export async function resolveZernioAccountId(platform: string): Promise<string | undefined> {
  const res = await listZernioAccounts()
  if (!res.ok || !res.data) return undefined
  const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []
  return accounts.find((a) => a.platform === platform)?.id
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
