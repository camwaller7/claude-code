import { adminSupabase } from '@/lib/supabase/admin'
import { OPUS, OPUS_INPUT_PER_1K, OPUS_OUTPUT_PER_1K } from '@/lib/billing/tiers'

// Usage windows computed on the fly from token_usage (which carries user_id,
// model, feature and created_at). No counter columns or reset jobs needed.

function startOfTodayUTC(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// Most recent Monday 00:00 UTC — the Opus weekly cap window (PRICING.md).
function startOfWeekUTC(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const backToMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - backToMonday)
  return d.toISOString()
}

// Atomically reserve one of today's interactions against the tier's daily cap.
// Returns the new running count when the reservation succeeds, or null when the
// cap is already reached. Unlike counting token_usage (which is written after
// the call, so concurrent requests race), this increments a counter in a single
// atomic statement BEFORE dispatch, so the cap can't be burst past. See
// migration 032.
export async function reserveDailyInteraction(
  userId: string,
  cap: number
): Promise<number | null> {
  const { data, error } = await adminSupabase.rpc('reserve_daily_interaction', {
    p_user_id: userId,
    p_cap: cap,
  })
  if (error) {
    // Fail open on infra errors rather than blocking a paying user's call; the
    // cap is a cost guardrail, not a security boundary.
    console.error('[limits] reserve_daily_interaction failed:', error.message)
    return 0
  }
  return (data as number | null) ?? null
}

// Count today's AI interactions for a user (categorisations + drafts + chat).
// Used for reporting/display; gating goes through reserveDailyInteraction.
export async function getDailyInteractionCount(userId: string): Promise<number> {
  const { count } = await adminSupabase
    .from('token_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfTodayUTC())
  return count ?? 0
}

// This week's Opus API spend for a user, in cents.
export async function getOpusWeekSpendCents(userId: string): Promise<number> {
  const { data } = await adminSupabase
    .from('token_usage')
    .select('input_tokens, output_tokens')
    .eq('user_id', userId)
    .eq('model', OPUS)
    .gte('created_at', startOfWeekUTC())

  let usd = 0
  for (const r of data ?? []) {
    usd += ((r.input_tokens ?? 0) / 1000) * OPUS_INPUT_PER_1K + ((r.output_tokens ?? 0) / 1000) * OPUS_OUTPUT_PER_1K
  }
  return Math.round(usd * 100)
}
