// App-level feature flags read from env. NEXT_PUBLIC_ so the same value is
// available on both the server (page guards, API routes) and the client
// (nav visibility) without a round-trip.

// Master switch for the post portal. Defaults to ON: publishing runs through
// Zernio's Posts API, reusing the same connected accounts as the inbox — no
// separate provider, connection, or cost. It's still gated to Growth/Pro (never
// Starter) via the tier feature `postPortal`. Set
// NEXT_PUBLIC_POST_PORTAL_ENABLED=false to hide it entirely.
export function postPortalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POST_PORTAL_ENABLED !== 'false'
}
