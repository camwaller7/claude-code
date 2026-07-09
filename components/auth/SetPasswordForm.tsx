'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORD_REQUIREMENTS, isPasswordValid } from '@/lib/auth/passwordPolicy'

export function SetPasswordForm({ isReset = false }: { isReset?: boolean }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setTouched(true)

    if (!isPasswordValid(password)) {
      setError('Please meet all password requirements below')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { has_password: true },
      })
      if (updateError) {
        setError(updateError.message)
        return
      }
      await fetch('/api/auth/password-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReset }),
      }).catch(() => {})
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setTouched(true) }}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {touched && (
        <ul className="space-y-1">
          {PASSWORD_REQUIREMENTS.map(req => {
            const met = req.test(password)
            return (
              <li key={req.id} className="flex items-center gap-1.5 text-xs" style={{ color: met ? '#3f5c50' : '#a89d90' }}>
                {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {req.label}
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="text-sm" style={{ color: '#a3452e' }}>{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Setting password…' : 'Set password & continue'}
      </Button>
    </form>
  )
}
