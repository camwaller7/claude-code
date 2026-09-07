'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Pack { kind: string; label: string; description: string }

// Buy-more usage packs. Each starts a one-time Stripe Checkout; the balance
// updates once the payment webhook lands.
export function TopUpPacks({
  packs,
  interactionCredits,
  opusCreditCents,
}: {
  packs: Pack[]
  interactionCredits: number
  opusCreditCents: number
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buy(kind: string) {
    setLoading(kind)
    setError(null)
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (data?.url) { window.location.assign(data.url); return }
      setError(data?.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">Usage top-ups</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ran out before your reset? Buy more without changing your plan.
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">
          Extra AI actions: <span className="font-semibold text-foreground">{interactionCredits}</span>
        </span>
        <span className="text-muted-foreground">
          Opus credit: <span className="font-semibold text-foreground">${(opusCreditCents / 100).toFixed(2)}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {packs.map(p => (
          <div key={p.kind} className="flex items-center justify-between rounded-xl border px-4 py-3">
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <Button variant="outline" onClick={() => buy(p.kind)} disabled={loading !== null}>
              {loading === p.kind ? 'Opening…' : 'Buy'}
            </Button>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}
