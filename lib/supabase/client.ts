import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const supabase = new Proxy({} as ReturnType<typeof getSupabaseBrowserClient>, {
  get(_target, prop) {
    return (getSupabaseBrowserClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
