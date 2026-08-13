import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseServiceRoleKey } from './env'

let _adminSupabase: SupabaseClient | null = null

function getAdminSupabase(): SupabaseClient {
  if (!_adminSupabase) {
    _adminSupabase = createClient(
      supabaseUrl(),
      supabaseServiceRoleKey(),
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
