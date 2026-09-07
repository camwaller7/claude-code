import { createServerClient } from '@/lib/supabase/server'

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
