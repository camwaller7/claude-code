export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth/requireAuth'
import { getUserSubscription, hasActivePlan } from '@/lib/billing/subscription'
import { billingEnabled } from '@/lib/stripe/client'
import { BillingActions } from '@/components/billing/BillingActions'

export default async function BillingPage() {
  // subscription:false so an unsubscribed user can actually reach this page.
  const session = await requireAuth({ subscription: false })
  const [sub, active] = await Promise.all([
    getUserSubscription(session.user.id),
    hasActivePlan(session.user.id),
  ])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your Corvelle subscription.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold capitalize">{sub?.plan ?? 'free'}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                     : 'bg-muted text-muted-foreground'
            }`}
          >
            {active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {sub?.current_period_end && (
          <p className="mt-3 text-xs text-muted-foreground">
            {active ? 'Renews' : 'Ended'} {new Date(sub.current_period_end).toLocaleDateString()}
          </p>
        )}

        <div className="mt-6">
          {billingEnabled() ? (
            <BillingActions hasPlan={active} />
          ) : (
            <p className="text-sm text-muted-foreground">Billing isn&apos;t configured yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
