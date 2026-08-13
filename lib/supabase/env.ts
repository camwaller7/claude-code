// Centralised, forgiving access to the Supabase connection env vars.
//
// A common deploy mistake is pasting NEXT_PUBLIC_SUPABASE_URL into the hosting
// dashboard with surrounding quotes, trailing whitespace/newline, or without
// the https:// scheme. Any of those makes @supabase/supabase-js throw
// "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL." and bricks login.
// Normalising here means those paste mistakes degrade gracefully instead.

function clean(value: string | undefined): string {
  if (!value) return ''
  // Strip whitespace and a single layer of surrounding quotes.
  return value.trim().replace(/^['"]|['"]$/g, '').trim()
}

export function supabaseUrl(): string {
  let url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url) return ''
  // Prepend the scheme if it was pasted without one (e.g. "xyz.supabase.co").
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  // Drop any trailing slash so downstream URL joins are predictable.
  return url.replace(/\/+$/, '')
}

export function supabaseAnonKey(): string {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function supabaseServiceRoleKey(): string {
  return clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}
