import { tierConfig, HAIKU, OPUS } from '@/lib/billing/tiers'
import { getUserTier } from '@/lib/billing/subscription'
import { reserveDailyInteraction, getOpusWeekSpendCents } from '@/lib/billing/limits'
import { getUserCredits } from '@/lib/billing/credits'

export interface ModelDecision {
  model: string
  tier: string
  // The switcher option the user asked for was honoured, downgraded, or blocked.
  requested?: string
  // Set when the choice was changed by a cap.
  capped?: 'opus_weekly' | null
  // Set when the daily interaction cap blocks the call entirely (Starter).
  blocked?: 'daily_limit' | null
  // This call is being served from purchased top-up credits; the caller must
  // consume them after the call succeeds.
  useInteractionCredit?: boolean
  useOpusCredit?: boolean
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

  // Starter daily interaction cap: atomically reserve a slot up front (so
  // concurrent calls can't all slip past the same pre-write count). If the cap
  // is reached, fall back to purchased interaction credits; block only when
  // those are gone too. The credit is consumed post-call by the caller.
  let useInteractionCredit = false
  if (cfg.dailyInteractionCap != null) {
    const reserved = await reserveDailyInteraction(userId, cfg.dailyInteractionCap)
    if (reserved == null) {
      const credits = await getUserCredits(userId)
      if (credits.interaction_credits > 0) {
        useInteractionCredit = true
      } else {
        return { model: cfg.defaultModel, tier, blocked: 'daily_limit', reason: `Daily limit of ${cfg.dailyInteractionCap} reached` }
      }
    }
  }

  // Pick the requested model if the tier allows it, else the tier default.
  let model = requestedModel && cfg.models.includes(requestedModel) ? requestedModel : cfg.defaultModel

  // Pro Opus weekly cap: once exceeded, keep Opus only if the user has Opus
  // top-up credit; otherwise drop to Haiku.
  let capped: ModelDecision['capped'] = null
  let useOpusCredit = false
  if (model === OPUS && cfg.opusWeeklyCapCents != null) {
    const spent = await getOpusWeekSpendCents(userId)
    if (spent >= cfg.opusWeeklyCapCents) {
      const credits = await getUserCredits(userId)
      if (credits.opus_credit_cents > 0) {
        useOpusCredit = true
      } else {
        model = HAIKU
        capped = 'opus_weekly'
      }
    }
  }

  return { model, tier, requested: requestedModel ?? undefined, capped, useInteractionCredit, useOpusCredit }
}
