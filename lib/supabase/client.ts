import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xbpgnqprsiembfwpzqit.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicGducXByc2llbWJmd3B6cWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjcyNDUsImV4cCI6MjA5NzY0MzI0NX0.yF0yrvfamZ-u28i6J_tDCPqr6atERWcaZA_12-yQ0Sw'

export function getSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

export const supabase = new Proxy({} as ReturnType<typeof getSupabaseBrowserClient>, {
  get(_target, prop) {
    return (getSupabaseBrowserClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
