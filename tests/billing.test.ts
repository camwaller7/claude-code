import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Tier config invariants ───────────────────────────────────────────────────
describe('tier config', () => {
  it('each tier has a default model within its allowed models', async () => {
    const { TIERS } = await import('@/lib/billing/tiers')
    for (const tier of Object.values(TIERS)) {
      expect(tier.models).toContain(tier.defaultModel)
      expect(tier.models.length).toBeGreaterThan(0)
    }
  })

  it('only Pro can use Opus; Starter is Haiku-only with a daily cap; Growth has no cap', async () => {
    const { TIERS, OPUS } = await import('@/lib/billing/tiers')
    expect(TIERS.starter.models).not.toContain(OPUS)
    expect(TIERS.growth.models).not.toContain(OPUS)
    expect(TIERS.pro.models).toContain(OPUS)
    expect(TIERS.starter.dailyInteractionCap).toBe(50)
    expect(TIERS.growth.dailyInteractionCap).toBeNull()
    expect(TIERS.pro.opusWeeklyCapCents).toBeGreaterThan(0)
    // Feature gates: brand deals / client portal are Growth+.
    expect(TIERS.starter.features.brandDeals).toBe(false)
    expect(TIERS.growth.features.brandDeals).toBe(true)
  })

  it('tierConfig falls back to starter for unknown/undefined tiers', async () => {
    const { tierConfig } = await import('@/lib/billing/tiers')
    expect(tierConfig(undefined).id).toBe('starter')
    expect(tierConfig('nonsense').id).toBe('starter')
    expect(tierConfig('pro').id).toBe('pro')
  })
})

// ── Price -> tier mapping (webhook depends on this, not mutable metadata) ─────
describe('tierForPriceId', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER_MONTH = 'price_starter_m'
    process.env.STRIPE_PRICE_GROWTH_MONTH = 'price_growth_m'
    process.env.STRIPE_PRICE_PRO_YEAR = 'price_pro_y'
  })
  afterEach(() => { process.env = { ...env } })

  it('maps a configured price id to its tier', async () => {
    const { tierForPriceId } = await import('@/lib/billing/prices')
    expect(tierForPriceId('price_starter_m')).toBe('starter')
    expect(tierForPriceId('price_growth_m')).toBe('growth')
    expect(tierForPriceId('price_pro_y')).toBe('pro')
  })

  it('returns undefined for an unknown price id (so the webhook can flag it)', async () => {
    const { tierForPriceId } = await import('@/lib/billing/prices')
    expect(tierForPriceId('price_unknown')).toBeUndefined()
  })
})
