'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Handles Supabase magic-link logins that arrive with tokens in the URL
 * hash fragment (#access_token=...). The server never sees fragments, so
 * this must run in the browser: it stores the session (which writes the
 * auth cookies) and then does a full page navigation so the server picks
 * them up.
 */
export function AuthHashHandler() {
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token')) return

    setStatus('working')
    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')

    if (!access_token || !refresh_token) {
      setStatus('error')
      return
    }

    // A magic link only ever verifies email ownership — it always routes
    // through set/reset-password rather than straight into the app, so a
    // working session can't be reached without going through a password step.
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          console.error('[auth] setSession error:', error.message)
          setStatus('error')
          return
        }
        window.location.replace('/auth/set-password')
      })
      .catch(() => setStatus('error'))
  }, [])

  if (status === 'working') {
    return (
      <p className="text-sm text-center text-muted-foreground animate-pulse">
        Signing you in…
      </p>
    )
  }
  if (status === 'error') {
    return (
      <p className="text-sm text-center text-destructive">
        Sign-in failed — please request a new link.
      </p>
    )
  }
  return null
}
