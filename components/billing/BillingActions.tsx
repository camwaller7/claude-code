'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

// Subscribe / Manage buttons. Each hits its billing route and redirects to the
// Stripe-hosted URL it returns.
export function BillingActions({ hasPlan }: { hasPlan: boolean }) {
  const [loading, setLoading] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function go(kind: 'checkout' | 'portal') {
    setLoading(kind)
    setError(null)
    try {
      const res = await fetch(`/api/billing/${kind}`, { method: 'POST' })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setError(data?.error ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hasPlan ? (
        <Button onClick={() => go('portal')} disabled={loading !== null}>
          {loading === 'portal' ? 'Opening…' : 'Manage subscription'}
        </Button>
      ) : (
        <Button onClick={() => go('checkout')} disabled={loading !== null}>
          {loading === 'checkout' ? 'Redirecting…' : 'Subscribe'}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
