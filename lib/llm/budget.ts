import { adminSupabase } from '@/lib/supabase/admin'
import { getModel } from '@/lib/llm/models'

// Month-to-date AI spend guard. Built on the token_usage table (every LLM call
// is logged there) so it works without any new infrastructure. Enforced before
// expensive calls so a runaway loop or abusive user can't silently run up the
// bill. When we move to multi-user, this becomes a per-user/per-plan cap by
// adding a user_id filter here.

// Conservative fallback pricing (per 1k tokens) for models not in our catalog,
// so an unknown model is never treated as free.
const FALLBACK_INPUT_PER_1K = 0.003
const FALLBACK_OUTPUT_PER_1K = 0.015

function monthStartISO(): string {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// Sum the estimated USD cost of all logged AI usage since the start of the month.
export async function getMonthlyAICostUsd(): Promise<number> {
  const { data } = await adminSupabase
    .from('token_usage')
    .select('model, input_tokens, output_tokens')
    .gte('created_at', monthStartISO())

  let cost = 0
  for (const r of data ?? []) {
    const m = getModel(r.model as string)
    const inPer1k = m?.inputPricePer1k ?? FALLBACK_INPUT_PER_1K
    const outPer1k = m?.outputPricePer1k ?? FALLBACK_OUTPUT_PER_1K
    cost += ((r.input_tokens ?? 0) / 1000) * inPer1k + ((r.output_tokens ?? 0) / 1000) * outPer1k
  }
  return cost
}

// The configured monthly cap in USD, or null when no cap is set (env unset or
// non-positive) — in which case the budget is not enforced.
export function getMonthlyBudgetUsd(): number | null {
  const v = Number(process.env.MONTHLY_AI_BUDGET_USD)
  return Number.isFinite(v) && v > 0 ? v : null
}

export interface BudgetStatus {
  over: boolean
  costUsd: number
  capUsd: number | null
}

// Check whether the month-to-date spend has reached the configured cap. Returns
// { over:false, capUsd:null } (without querying) when no cap is configured.
export async function checkAIBudget(): Promise<BudgetStatus> {
  const capUsd = getMonthlyBudgetUsd()
  if (capUsd === null) return { over: false, costUsd: 0, capUsd: null }
  const costUsd = await getMonthlyAICostUsd()
  return { over: costUsd >= capUsd, costUsd, capUsd }
}
