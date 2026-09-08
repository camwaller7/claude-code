// Subscription tiers and their AI-model allocation, per PRICING.md.
//
// Model ids: Haiku 4.5, Sonnet 5, Opus 5. Opus/Sonnet ids can be overridden by
// env so they track the latest snapshot without a code change.
export const HAIKU = 'claude-haiku-4-5-20251001'
export const SONNET = process.env.SONNET_MODEL_ID ?? 'claude-sonnet-5'
export const OPUS = process.env.OPUS_MODEL_ID ?? 'claude-opus-5'

export type Tier = 'starter' | 'growth' | 'pro'

// User-facing switcher labels — plain language, not model names (PRICING.md).
export const MODEL_LABELS: Record<string, string> = {
  [OPUS]: 'Powerful',
  [SONNET]: 'Quality',
  [HAIKU]: 'Fast',
}

export interface TierConfig {
  id: Tier
  name: string
  priceMonthly: number
  // Models the tier may use, in switcher display order. First is the default.
  models: string[]
  defaultModel: string
  // Whether the in-chat model switcher is shown (Starter has none).
  switcher: boolean
  // Starter only: max AI interactions per day (categorisations + drafts + chat).
  dailyInteractionCap: number | null
  // Pro only: weekly Opus API-spend cap in cents; over it, Opus auto-drops to
  // Haiku until the next Monday.
  opusWeeklyCapCents: number | null
  // Non-AI feature gates.
  features: {
    brandDeals: boolean
    clientPortal: boolean
    fullDashboard: boolean
    extraPlatforms: boolean // X, TikTok, Threads, Gmail
    postPortal: boolean // scheduling/publishing — excluded from Starter
  }
}

export const TIERS: Record<Tier, TierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    models: [HAIKU],
    defaultModel: HAIKU,
    switcher: false,
    dailyInteractionCap: 50,
    opusWeeklyCapCents: null,
    features: { brandDeals: false, clientPortal: false, fullDashboard: false, extraPlatforms: false, postPortal: false },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 79,
    models: [SONNET, HAIKU],
    defaultModel: SONNET,
    switcher: true,
    dailyInteractionCap: null,
    opusWeeklyCapCents: null,
    features: { brandDeals: true, clientPortal: true, fullDashboard: true, extraPlatforms: true, postPortal: true },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    models: [OPUS, SONNET, HAIKU],
    defaultModel: OPUS,
    switcher: true,
    dailyInteractionCap: null,
    // ~$5/week of Opus spend (PRICING.md).
    opusWeeklyCapCents: 500,
    features: { brandDeals: true, clientPortal: true, fullDashboard: true, extraPlatforms: true, postPortal: true },
  },
}

export function tierConfig(tier: string | null | undefined): TierConfig {
  return TIERS[(tier as Tier)] ?? TIERS.starter
}

// Approx Opus 5 API rates (USD per 1k tokens) for weekly-cap accounting.
export const OPUS_INPUT_PER_1K = 0.005
export const OPUS_OUTPUT_PER_1K = 0.025
