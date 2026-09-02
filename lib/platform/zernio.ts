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

// Send a DM reply into an existing Zernio conversation. The conversation
// implies the sending account, so no accountId is required here.
//
// Zernio's send endpoint rejected a `{ message }` body with a Zod
// "expected string, received undefined" error, meaning it reads the reply text
// from a differently-named field. Its schema ignores unknown keys (it did not
// complain about the extra `message` key), so we send the text under every
// common alias — the one Zernio expects is picked up and the rest are ignored.
export function sendZernioMessage(conversationId: string, message: string) {
  return zernioFetch<{ id: string }>(
    `/v1/inbox/conversations/${conversationId}/messages`,
    { method: 'POST', body: { message, text: message, content: message, body: message } }
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
      events: ['message.received', 'conversation.started'],
    },
  })
}
