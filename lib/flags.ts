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

// Comped trial: during the 3-month multi-user trial, creators get full access
// with no payment. When on, the subscription paywall is skipped and every user
// without a paid subscription is treated as the comped tier (below) instead of
// the Starter floor. Set NEXT_PUBLIC_TRIAL_MODE=true to enable.
export function trialModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TRIAL_MODE === 'true'
}

// The tier comped-trial users get. Defaults to 'growth' — all features on,
// Sonnet as the default model with the switcher, no daily interaction cap, but
// NOT Opus (kept off so trial cost can't run away; the per-user AI spend cap
// still applies). Override with NEXT_PUBLIC_TRIAL_TIER=pro if you want Opus.
export function trialTier(): string {
  const t = process.env.NEXT_PUBLIC_TRIAL_TIER
  return t === 'pro' || t === 'growth' || t === 'starter' ? t : 'growth'
}
