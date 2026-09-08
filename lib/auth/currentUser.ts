import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'

// Multi-user rollout flag. While false the app behaves as the single-creator
// pilot (owner-only gate, unscoped writes). Flip to true — AFTER migration 021
// is applied — to activate per-user tenancy: sign-ups, user_id scoping, per-user
// social connections and billing. Lets the multi-user code ship incrementally
// without disturbing the running pilot.
export function multiUserEnabled(): boolean {
  return process.env.MULTIUSER_ENABLED === 'true'
}

// The authenticated user's id for the current request, or null when there's no
// valid session. Verifies the JWT against Supabase (getUser), not just the
// cookie. Use in user-facing routes to stamp/scope rows by owner.
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

// Whether the current session belongs to the app owner. Used to gate the
// owner-only surfaces that survive into multi-user mode — the direct-OAuth
// platform connect/callback flows and post-portal publishing (Zernio has no
// publishing API, and per-trial-user Meta OAuth would exceed Meta's test-user
// limit, so auto-publish stays owner-only until real App Review). Verifies the
// JWT via getUser, so it's safe as an access boundary.
export async function currentUserIsOwner(): Promise<boolean> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    return isOwnerEmail(data.user?.email)
  } catch {
    return false
  }
}

// The user id to scope rows by, or null in single-tenant mode. Use to
// conditionally add `.eq('user_id', id)` to reads and `user_id: id` to writes:
// null means "don't scope" (pilot behaviour), a value means per-user isolation.
export async function scopedUserId(): Promise<string | null> {
  if (!multiUserEnabled()) return null
  return getCurrentUserId()
}
