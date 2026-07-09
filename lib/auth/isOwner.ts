/**
 * This is a single-creator app. RLS grants any authenticated Supabase user
 * full access to every table, so the only real access boundary is: does the
 * signed-in email match the one owner this app was built for. Every route
 * and page guard must call this — RLS alone is not enough because Supabase
 * magic-link sign-up is open to any email by default.
 *
 * Set OWNER_EMAIL in your deployment env vars. Until it's set, this fails
 * open with a console warning rather than locking the creator out — but a
 * missing OWNER_EMAIL should be treated as a deploy blocker before real
 * accounts are connected.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!owner) {
    console.warn('[security] OWNER_EMAIL is not set — access is NOT restricted to a single user. Set OWNER_EMAIL before connecting real accounts.')
    return true
  }
  return !!email && email.trim().toLowerCase() === owner
}
