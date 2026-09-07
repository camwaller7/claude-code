'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Interval = 'month' | 'year'

interface Plan {
  tier: 'starter' | 'growth' | 'pro'
  name: string
  monthly: number
  annualPerMonth: number
  annualTotal: number
  tagline: string
  featured?: boolean
  features: string[]
}

// Display copy mirrors PRICING.md (20% annual discount).
const PLANS: Plan[] = [
  {
    tier: 'starter', name: 'Starter', monthly: 29, annualPerMonth: 23, annualTotal: 276,
    tagline: 'Core inbox + scheduling on Instagram & Facebook.',
    features: [
      'Instagram + Facebook inbox',
      'AI replies (Fast model)',
      'Post scheduling (IG + FB)',
      'Basic KPI dashboard',
      '50 AI actions / day',
    ],
  },
  {
    tier: 'growth', name: 'Growth', monthly: 79, annualPerMonth: 63, annualTotal: 756,
    tagline: 'For active creators across every platform.', featured: true,
    features: [
      'Everything in Starter',
      'X, Threads, TikTok & Gmail',
      'Unlimited Quality AI (Sonnet)',
      'Brand-deal pipeline (CRM)',
      'Client portal + full dashboard',
      'Model switcher',
    ],
  },
  {
    tier: 'pro', name: 'Pro', monthly: 149, annualPerMonth: 119, annualTotal: 1428,
    tagline: 'The flagship AI tier for full-time creators.',
    features: [
      'Everything in Growth',
      'Powerful AI (Opus, weekly cap)',
      'Three-model switcher',
      'Advanced revenue analytics',
      'Priority notifications',
    ],
  },
]

export function PricingPlans({ currentTier, active }: { currentTier?: string; active: boolean }) {
  const [interval, setInterval] = useState<Interval>('month')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function subscribe(tier: string) {
    setLoading(tier)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (data?.url) { window.location.href = data.url; return }
      setError(data?.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Interval toggle */}
      <div className="flex items-center justify-center gap-2">
        <div className="inline-flex rounded-full border p-1">
          {(['month', 'year'] as Interval[]).map(i => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={cn(
                'rounded-full px-4 py-1 text-sm transition-colors',
                interval === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {i === 'month' ? 'Monthly' : 'Annual · save 20%'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = active && currentTier === plan.tier
          const price = interval === 'month' ? plan.monthly : plan.annualPerMonth
          return (
            <div
              key={plan.tier}
              className={cn(
                'flex flex-col rounded-2xl border p-6',
                plan.featured ? 'border-primary shadow-lg' : 'bg-card'
              )}
            >
              {plan.featured && (
                <span className="mb-2 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">${price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
                {interval === 'year' && (
                  <p className="text-[11px] text-muted-foreground">billed ${plan.annualTotal}/year</p>
                )}
              </div>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6"
                variant={plan.featured ? 'default' : 'outline'}
                disabled={loading !== null || isCurrent}
                onClick={() => subscribe(plan.tier)}
              >
                {isCurrent ? 'Current plan' : loading === plan.tier ? 'Redirecting…' : 'Choose ' + plan.name}
              </Button>
            </div>
          )
        })}
      </div>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  )
}
