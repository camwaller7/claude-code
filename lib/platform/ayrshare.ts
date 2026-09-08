// Ayrshare multi-user publishing client (https://www.ayrshare.com).
//
// Ayrshare is a social-publishing API built for SaaS: instead of each creator
// going through Meta App Review (which caps us at Meta's test-user limit), each
// app user gets an Ayrshare "user profile" (identified by a profileKey). The
// user links their own social accounts through Ayrshare's hosted SSO page, and
// we publish on their behalf by sending the profileKey with each request. This
// is what makes the post portal work for public trial users, and it also covers
// Threads and TikTok, which the direct-Meta path never could.
//
// Docs: https://www.ayrshare.com/docs
//   Base:      https://api.ayrshare.com/api
//   Auth:      Authorization: Bearer <AYRSHARE_API_KEY>   (Business plan key)
//   Per-user:  Profile-Key: <profileKey>                  (act as that user)
//   Profiles:  POST   /profiles            create a user profile
//              DELETE /profiles            delete a user profile
//              POST   /profiles/generateJWT  hosted SSO linking URL
//   Publish:   POST   /post                publish/schedule a post
//   Status:    GET    /user                the profile's linked accounts

const AYRSHARE_BASE = process.env.AYRSHARE_BASE_URL ?? 'https://api.ayrshare.com/api'

export function ayrshareEnabled(): boolean {
  return Boolean(process.env.AYRSHARE_API_KEY)
}

// Ayrshare uses "twitter" for X and otherwise matches our platform slugs. Map
// our internal Platform values to Ayrshare's platform strings.
const PLATFORM_TO_AYRSHARE: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'twitter',
  threads: 'threads',
  tiktok: 'tiktok',
}
const AYRSHARE_TO_PLATFORM: Record<string, string> = {
  twitter: 'x',
  instagram: 'instagram',
  facebook: 'facebook',
  threads: 'threads',
  tiktok: 'tiktok',
}

export function toAyrsharePlatform(p: string): string {
  return PLATFORM_TO_AYRSHARE[p] ?? p
}
export function fromAyrsharePlatform(p: string): string {
  return AYRSHARE_TO_PLATFORM[p] ?? p
}

interface AyrshareResult<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

async function ayrshareFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; profileKey?: string }
): Promise<AyrshareResult<T>> {
  const apiKey = process.env.AYRSHARE_API_KEY
  if (!apiKey) return { ok: false, status: 0, error: 'AYRSHARE_API_KEY not set' }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  // Scope the request to a single app user's linked accounts.
  if (init?.profileKey) headers['Profile-Key'] = init.profileKey

  let res: Response
  try {
    res = await fetch(`${AYRSHARE_BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body != null ? JSON.stringify(init.body) : undefined,
    })
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network error' }
  }

  const raw = await res.text()
  let parsed: unknown = undefined
  try {
    parsed = raw ? JSON.parse(raw) : undefined
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const errMsg =
      (parsed as { message?: string })?.message ??
      (parsed as { error?: string })?.error ??
      `Ayrshare API returned ${res.status}`
    return { ok: false, status: res.status, error: errMsg }
  }
  return { ok: true, status: res.status, data: parsed as T }
}

// ─── Profiles (one per app user) ──────────────────────────────────────────────

export interface AyrshareProfile {
  status?: string
  profileKey?: string
  refId?: string
  title?: string
}

// Create a new Ayrshare user profile. `title` is a human label (we use the
// app user's id/email) so profiles are identifiable in the Ayrshare dashboard.
export function createAyrshareProfile(title: string) {
  return ayrshareFetch<AyrshareProfile>('/profiles', {
    method: 'POST',
    body: { title },
  })
}

// Permanently delete an Ayrshare user profile (used on account deletion).
export function deleteAyrshareProfile(profileKey: string) {
  return ayrshareFetch<{ status: string }>('/profiles', {
    method: 'DELETE',
    body: { profileKey },
  })
}

// Generate a hosted SSO URL the user opens to link/unlink their own social
// accounts. Requires the RSA private key downloaded from the Ayrshare dashboard
// (AYRSHARE_PRIVATE_KEY, PEM) and the account domain (AYRSHARE_DOMAIN).
export async function generateAyrshareLinkUrl(profileKey: string) {
  const privateKey = process.env.AYRSHARE_PRIVATE_KEY
  const domain = process.env.AYRSHARE_DOMAIN
  if (!privateKey || !domain) {
    return {
      ok: false as const,
      status: 0,
      error: 'AYRSHARE_PRIVATE_KEY and AYRSHARE_DOMAIN must be set to generate a linking URL.',
    }
  }
  return ayrshareFetch<{ url?: string; token?: string; emailSent?: boolean }>(
    '/profiles/generateJWT',
    {
      method: 'POST',
      // PEM keys carry literal newlines; env vars often store them escaped.
      body: { domain, privateKey: privateKey.replace(/\\n/g, '\n'), profileKey },
    }
  )
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface AyrshareUser {
  activeSocialAccounts?: string[]
  displayNames?: { platform: string; displayName?: string; username?: string }[]
}

// The social accounts a given profile has linked. Used to show the user which
// platforms are ready and to validate a post's target platforms before sending.
export function getAyrshareUser(profileKey: string) {
  return ayrshareFetch<AyrshareUser>('/user', { profileKey })
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export interface AyrsharePostResult {
  status?: string
  id?: string
  errors?: { platform?: string; message?: string; action?: string }[]
  postIds?: { platform: string; id?: string; postUrl?: string; status?: string }[]
}

// Publish (or schedule) a post to the given platforms on behalf of one profile.
// `platforms` are our internal slugs; they're mapped to Ayrshare's names here.
// `scheduleDate` (ISO) schedules for later; omit to publish immediately.
export function publishToAyrshare(
  profileKey: string,
  opts: { post: string; platforms: string[]; mediaUrls?: string[]; scheduleDate?: string }
) {
  const body: Record<string, unknown> = {
    post: opts.post,
    platforms: opts.platforms.map(toAyrsharePlatform),
  }
  if (opts.mediaUrls && opts.mediaUrls.length > 0) body.mediaUrls = opts.mediaUrls
  if (opts.scheduleDate) body.scheduleDate = opts.scheduleDate
  return ayrshareFetch<AyrsharePostResult>('/post', {
    method: 'POST',
    body,
    profileKey,
  })
}
