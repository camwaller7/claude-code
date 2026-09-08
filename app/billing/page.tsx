export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth/requireAuth'
import { getUserSubscription, hasActivePlan } from '@/lib/billing/subscription'
import { billingEnabled } from '@/lib/stripe/client'
import { BillingActions } from '@/components/billing/BillingActions'
import { PricingPlans } from '@/components/billing/PricingPlans'
import { TopUpPacks } from '@/components/billing/TopUpPacks'
import { getUserCredits, TOPUPS } from '@/lib/billing/credits'

export default async function BillingPage() {
  // subscription:false so an unsubscribed user can actually reach this page.
  const session = await requireAuth({ subscription: false })
  const [sub, active, credits] = await Promise.all([
    getUserSubscription(session.user.id),
    hasActivePlan(session.user.id),
    getUserCredits(session.user.id),
  ])

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The whole business side of creating, handled.
        </p>
      </div>

      {/* Current subscription summary + manage, shown once subscribed. */}
      {active && (
        <div className="mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl border bg-card p-5">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold capitalize">{sub?.tier ?? sub?.plan ?? 'free'}</p>
            {sub?.current_period_end && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Renews {new Date(sub.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
          <BillingActions hasPlan={active} />
        </div>
      )}

      {/* Usage top-ups — only relevant once subscribed. */}
      {active && billingEnabled() && (
        <div className="mx-auto w-full max-w-lg">
          <TopUpPacks
            packs={Object.values(TOPUPS).map(p => ({ kind: p.kind, label: p.label, description: p.description }))}
            interactionCredits={credits.interaction_credits}
            opusCreditCents={credits.opus_credit_cents}
          />
        </div>
      )}

      {billingEnabled() ? (
        <PricingPlans currentTier={sub?.tier} active={active} />
      ) : (
        <p className="text-center text-sm text-muted-foreground">Billing isn&apos;t configured yet.</p>
      )}
    </div>
  )
}
