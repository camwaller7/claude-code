import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { multiUserEnabled, getCurrentUserId } from '@/lib/auth/currentUser'
import { getUserTier } from '@/lib/billing/subscription'
import { tierConfig, MODEL_LABELS, OPUS } from '@/lib/billing/tiers'
import { getOpusWeekSpendCents } from '@/lib/billing/limits'

// Tells the chat UI which models the current user may pick (the switcher), with
// plain-language labels and a disabled flag for a capped Opus option.
export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  // Single-tenant pilot has no per-tier switcher.
  if (!multiUserEnabled()) {
    return NextResponse.json({ switcher: false, models: [] })
  }

  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ switcher: false, models: [] })

  const tier = await getUserTier(userId)
  const cfg = tierConfig(tier)

  // Disable Opus in the switcher when the weekly cap is spent.
  let opusCapped = false
  if (cfg.models.includes(OPUS) && cfg.opusWeeklyCapCents != null) {
    opusCapped = (await getOpusWeekSpendCents(userId)) >= cfg.opusWeeklyCapCents
  }

  const models = cfg.models.map((id) => ({
    id,
    label: MODEL_LABELS[id] ?? id,
    disabled: id === OPUS && opusCapped,
    reason: id === OPUS && opusCapped ? 'Weekly limit reached — resets Monday' : undefined,
  }))

  return NextResponse.json({ switcher: cfg.switcher, tier, defaultModel: cfg.defaultModel, models })
}
