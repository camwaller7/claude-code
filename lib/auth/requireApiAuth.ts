import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import { multiUserEnabled } from '@/lib/auth/currentUser'

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
      return null
    }
  } catch {
    // fall through to 401
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
