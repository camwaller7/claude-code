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

// Count today's AI interactions for a user (categorisations + drafts + chat).
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
