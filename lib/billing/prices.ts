import type { Tier } from '@/lib/billing/tiers'

export type Interval = 'month' | 'year'

// Resolve the Stripe Price id for a tier + interval from env, e.g.
// STRIPE_PRICE_GROWTH_MONTH / STRIPE_PRICE_PRO_YEAR. Falls back to the single
// STRIPE_PRICE_ID (back-compat with the first billing cut) when a specific one
// isn't configured.
export function priceIdFor(tier: Tier, interval: Interval): string | undefined {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${interval === 'year' ? 'YEAR' : 'MONTH'}`
  return process.env[key] ?? process.env.STRIPE_PRICE_ID
}

// Reverse lookup: which tier a Stripe price id belongs to, from our env mapping.
// Preferred over trusting mutable price.metadata.tier in the webhook. Returns
// undefined when the price id isn't one we configured.
export function tierForPriceId(priceId: string): Tier | undefined {
  const tiers: Tier[] = ['starter', 'growth', 'pro']
  for (const tier of tiers) {
    for (const interval of ['month', 'year'] as Interval[]) {
      if (priceIdFor(tier, interval) === priceId) return tier
    }
  }
  return undefined
}
