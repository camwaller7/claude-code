import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { billingEnabled } from '@/lib/stripe/client'
import { hasActivePlan } from '@/lib/billing/subscription'

// Paths reachable without an active subscription, so a user can actually
// subscribe / manage billing / connect accounts while on the free gate.
const PLAN_EXEMPT_PREFIXES = ['/api/billing/', '/api/zernio/connect', '/api/media']

// Owner-only surfaces in multi-user mode: the direct-platform OAuth flows
// (Meta/IG/X/Gmail/Threads/Telegram connect + callbacks). These predate per-user
// scoping and hold the owner's own legacy tokens. Trial users connect messaging
// through Zernio (/api/zernio/*) and publishing through Ayrshare
// (/api/ayrshare/*), never these. Post publishing itself is NOT owner-only —
// any user can publish through their own linked Ayrshare profile.
const OWNER_ONLY_PREFIXES = [
  '/api/meta/',
  '/api/instagram/',
  '/api/threads/',
  '/api/gmail/',
  '/api/x/',
  '/api/telegram/',
]
function isOwnerOnlyPath(path: string): boolean {
  return OWNER_ONLY_PREFIXES.some((p) => path.startsWith(p))
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Auth guard for API routes. Returns null when the request carries a valid
 * session belonging to the app owner; otherwise returns a 401/403 response
 * the route should return as-is.
 *
 * RLS grants any authenticated Supabase user full table access, so this
 * owner-email check is the real access boundary — not just "is logged in".
 *
 * Internal/background callers (Inngest sync jobs) can authenticate with the
 * INTERNAL_API_SECRET header instead of a cookie session.
 */
export async function requireApiAuth(request?: Request): Promise<NextResponse | null> {
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (request && internalSecret) {
    const header = request.headers.get('x-internal-secret')
    if (header && safeEqual(header, internalSecret)) return null
  }

  if (process.env.MAINTENANCE_MODE === 'true') {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Single-tenant pilot: only the owner email is allowed. Multi-user: any
      // authenticated user passes (per-user RLS + user_id scoping isolate data).
      if (!multiUserEnabled() && !isOwnerEmail(user.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      // Multi-user paywall: non-owner users need an active subscription to reach
      // data/AI endpoints. Enforced here (not just on page navigation) so the
      // API itself can't be called directly without a plan. Billing/connect
      // paths stay reachable so a user can subscribe.
      if (multiUserEnabled() && !isOwnerEmail(user.email)) {
        const path = request ? new URL(request.url).pathname : ''
        // Owner-only surfaces (direct-OAuth connect/callback, publishing) are
        // never reachable by trial users.
        if (isOwnerOnlyPath(path)) {
          return NextResponse.json({ error: 'Not available on your plan' }, { status: 403 })
        }
        // Multi-user paywall: non-owner users need an active subscription to
        // reach data/AI endpoints. Billing/connect paths stay reachable.
        if (billingEnabled()) {
          const exempt = PLAN_EXEMPT_PREFIXES.some(p => path.startsWith(p))
          if (!exempt && !(await hasActivePlan(user.id))) {
            return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
          }
        }
      }
      return null
    }
  } catch {
    // fall through to 401
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
