import Stripe from 'stripe'

// Lazily construct the Stripe client so importing this module never throws when
// STRIPE_SECRET_KEY is unset (e.g. in the single-tenant pilot with billing off).
// Call getStripe() from billing routes; it throws only when actually used.
let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cached = new Stripe(key)
  return cached
}

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
}
