'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CURRENT_TERMS_VERSION } from '@/lib/auth/requireAuth'

export function AcceptTermsForm() {
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!checked) return
    setError(null)
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          terms_accepted_version: CURRENT_TERMS_VERSION,
          terms_accepted_at: new Date().toISOString(),
        },
      })
      if (updateError) {
        setError(updateError.message)
        return
      }
      await fetch('/api/auth/accept-terms', { method: 'POST' }).catch(() => {})
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-start gap-3 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-current"
        />
        <span>
          I have read and agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      {error && <p className="text-sm" style={{ color: '#a3452e' }}>{error}</p>}

      <Button className="w-full" disabled={!checked || loading} onClick={handleContinue}>
        {loading ? 'Continuing…' : 'Agree & Continue'}
      </Button>
    </div>
  )
}
