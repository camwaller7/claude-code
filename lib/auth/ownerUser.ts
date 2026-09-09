import { adminSupabase } from '@/lib/supabase/admin'

// The app owner's auth user id (app_owner.email → auth.users), via the
// service-role-only owner_user_id() function. Cached per server instance — the
// owner never changes at runtime. Returns null if unresolved (no owner mapped).
let cached: string | null | undefined

export async function getOwnerUserId(): Promise<string | null> {
  if (cached !== undefined) return cached
  try {
    const { data, error } = await adminSupabase.rpc('owner_user_id')
    if (error) {
      console.error('[owner] owner_user_id RPC failed:', error.message)
      return null // don't cache a transient failure
    }
    cached = (data as string | null) ?? null
  } catch (e) {
    console.error('[owner] owner_user_id resolve error:', e)
    return null
  }
  return cached
}
