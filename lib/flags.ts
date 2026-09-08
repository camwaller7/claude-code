// App-level feature flags read from env. NEXT_PUBLIC_ so the same value is
// available on both the server (page guards, API routes) and the client
// (nav visibility) without a round-trip.

// Master switch for the post portal. Defaults to OFF: publishing is hidden for
// the trial (Zernio has no publish API and a multi-user publisher's base fee
// isn't worth it at pilot volume). Set NEXT_PUBLIC_POST_PORTAL_ENABLED=true to
// bring it back — when on, it's still gated to Growth/Pro (not Starter) via the
// tier feature `postPortal`.
export function postPortalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POST_PORTAL_ENABLED === 'true'
}
