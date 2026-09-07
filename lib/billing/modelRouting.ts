import { tierConfig, HAIKU, OPUS } from '@/lib/billing/tiers'
import { getUserTier } from '@/lib/billing/subscription'
import { getDailyInteractionCount, getOpusWeekSpendCents } from '@/lib/billing/limits'

export interface ModelDecision {
  model: string
  tier: string
  // The switcher option the user asked for was honoured, downgraded, or blocked.
  requested?: string
  // Set when the choice was changed by a cap.
  capped?: 'opus_weekly' | null
  // Set when the daily interaction cap blocks the call entirely (Starter).
  blocked?: 'daily_limit' | null
  reason?: string
}

// Decide which model a user's AI call should run on, honouring their tier's
// allowed models, their (optional) switcher choice, and the tier caps:
//   - Starter: Haiku only; blocked once the daily interaction cap is hit.
//   - Growth:  Sonnet default, Haiku via switcher; no cap.
//   - Pro:     Opus default, Sonnet/Haiku via switcher; Opus auto-drops to
//              Haiku once the weekly Opus spend cap is reached.
export async function resolveModelForUser(
  userId: string,
  requestedModel?: string | null
): Promise<ModelDecision> {
  const tier = await getUserTier(userId)
  const cfg = tierConfig(tier)

  // Starter daily interaction cap blocks the call outright.
  if (cfg.dailyInteractionCap != null) {
    const used = await getDailyInteractionCount(userId)
    if (used >= cfg.dailyInteractionCap) {
      return { model: cfg.defaultModel, tier, blocked: 'daily_limit', reason: `Daily limit of ${cfg.dailyInteractionCap} reached` }
    }
  }

  // Pick the requested model if the tier allows it, else the tier default.
  let model = requestedModel && cfg.models.includes(requestedModel) ? requestedModel : cfg.defaultModel

  // Pro Opus weekly cap: drop to Haiku once exceeded.
  let capped: ModelDecision['capped'] = null
  if (model === OPUS && cfg.opusWeeklyCapCents != null) {
    const spent = await getOpusWeekSpendCents(userId)
    if (spent >= cfg.opusWeeklyCapCents) {
      model = HAIKU
      capped = 'opus_weekly'
    }
  }

  return { model, tier, requested: requestedModel ?? undefined, capped }
}
