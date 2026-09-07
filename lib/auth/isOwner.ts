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
  // OWNER_EMAIL may be a single address or a comma-separated allowlist. The
  // allowlist exists so a dedicated Meta App Review test account can be granted
  // access for the review without exposing or sharing the creator's own login —
  // add the reviewer test email during review, remove it after approval.
  const owners = (process.env.OWNER_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (owners.length === 0) {
    // Fail CLOSED (audit C4): with no owner configured, deny access rather than
    // granting everyone owner rights. OWNER_EMAIL must be set in production.
    console.error('[security] OWNER_EMAIL is not set — denying access. Set OWNER_EMAIL.')
    return false
  }
  return !!email && owners.includes(email.trim().toLowerCase())
}
