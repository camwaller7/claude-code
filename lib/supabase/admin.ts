import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _adminSupabase: SupabaseClient | null = null

function getAdminSupabase(): SupabaseClient {
  if (!_adminSupabase) {
    _adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _adminSupabase
}

export const adminSupabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAdminSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
