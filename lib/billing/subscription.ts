import { adminSupabase } from '@/lib/supabase/admin'

// Subscription state for a user, read from the subscriptions table (written by
// the Stripe webhook). Absence of a row means no paid plan.

export interface Subscription {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string
  status: string
  current_period_end: string | null
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await adminSupabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Subscription | null) ?? null
}

// Whether the user has an entitlement to the paid product right now. past_due is
// treated as still-active (grace period) so a failed renewal doesn't instantly
// lock someone out mid-cycle; Stripe moves it to canceled/unpaid when dunning
// gives up, which then fails this check.
export async function hasActivePlan(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId)
  if (!sub) return false
  if (!ACTIVE_STATUSES.has(sub.status)) return false
  if (sub.current_period_end && new Date(sub.current_period_end).getTime() < Date.now()) {
    // Only trust an expired period end when the status itself isn't active.
    return sub.status === 'active' || sub.status === 'trialing'
  }
  return true
}
