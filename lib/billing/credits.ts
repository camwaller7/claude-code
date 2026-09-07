import { adminSupabase } from '@/lib/supabase/admin'

export interface UserCredits {
  interaction_credits: number
  opus_credit_cents: number
}

// Buyable top-up packs. `interactions` extends the Starter daily cap; `opus`
// extends the Pro weekly Opus cap (amount is in cents of Opus API spend).
export type TopupKind = 'interactions' | 'opus'

export interface TopupPack {
  kind: TopupKind
  label: string
  description: string
  priceEnv: string // env var holding the Stripe Price id for this pack
  // What the purchase grants: interactions count OR opus spend cents.
  grantInteractions: number
  grantOpusCents: number
}

export const TOPUPS: Record<TopupKind, TopupPack> = {
  interactions: {
    kind: 'interactions',
    label: '100 extra AI actions',
    description: 'Adds 100 AI actions on top of your daily allowance.',
    priceEnv: 'STRIPE_PRICE_TOPUP_INTERACTIONS',
    grantInteractions: 100,
    grantOpusCents: 0,
  },
  opus: {
    kind: 'opus',
    label: '$5 Opus credit',
    description: 'Adds $5 of Powerful-model (Opus) usage beyond your weekly cap.',
    priceEnv: 'STRIPE_PRICE_TOPUP_OPUS',
    grantInteractions: 0,
    grantOpusCents: 500,
  },
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const { data } = await adminSupabase
    .from('user_credits')
    .select('interaction_credits, opus_credit_cents')
    .eq('user_id', userId)
    .maybeSingle()
  return {
    interaction_credits: data?.interaction_credits ?? 0,
    opus_credit_cents: data?.opus_credit_cents ?? 0,
  }
}

export async function addCredits(userId: string, interactions: number, opusCents: number): Promise<void> {
  await adminSupabase.rpc('add_user_credits', {
    p_user_id: userId,
    p_interactions: interactions,
    p_opus_cents: opusCents,
  })
}

export async function consumeCredits(userId: string, interactions: number, opusCents: number): Promise<void> {
  await adminSupabase.rpc('consume_user_credits', {
    p_user_id: userId,
    p_interactions: interactions,
    p_opus_cents: opusCents,
  })
}
