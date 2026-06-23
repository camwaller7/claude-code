import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbpgnqprsiembfwpzqit.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicGducXByc2llbWJmd3B6cWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjcyNDUsImV4cCI6MjA5NzY0MzI0NX0.yF0yrvfamZ-u28i6J_tDCPqr6atERWcaZA_12-yQ0Sw'

export async function createServerClient() {
  const cookieStore = await cookies()
  return _createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}

export async function createRouteHandlerSupabase() {
  return createServerClient()
}
