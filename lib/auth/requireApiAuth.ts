import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Auth guard for API routes. Returns null when the request carries a valid
 * session; otherwise returns a 401 response the route should return as-is.
 *
 * Internal/background callers (Inngest sync jobs) can authenticate with the
 * INTERNAL_API_SECRET header instead of a cookie session.
 */
export async function requireApiAuth(request?: Request): Promise<NextResponse | null> {
  const internalSecret = process.env.INTERNAL_API_SECRET
  if (request && internalSecret) {
    const header = request.headers.get('x-internal-secret')
    if (header && header === internalSecret) return null
  }

  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return null
  } catch {
    // fall through to 401
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
