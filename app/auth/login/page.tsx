export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'

type Props = { searchParams: Promise<{ error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  let hasSession = false
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    hasSession = !!session
  } catch (e) {
    console.error('[login] supabase error:', e)
  }
  if (hasSession) redirect('/dashboard')

  const { error } = await searchParams

  // Opening page is intentionally Soft Studio — warm, calm, boutique —
  // regardless of the in-app look the user picks later.
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f7f2ec', color: '#2e2621' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center flex flex-col gap-3">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ background: '#3f5c50', color: '#f7f2ec' }}
          >
            ✦
          </span>
          <h1
            className="text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Creator PA
          </h1>
          <p className="text-sm" style={{ color: '#7d746a', maxWidth: '38ch', margin: '0 auto' }}>
            Your inbox, brand deals, clients and content — beautifully kept in one place.
          </p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{ background: '#fffdf9', border: '1px solid #e9dfd2', boxShadow: '0 2px 24px rgba(46, 38, 33, 0.06)' }}
        >
          {error === 'auth' && (
            <p className="mb-4 text-sm text-center" style={{ color: '#a3452e' }}>
              Sign-in failed. Please request a new link.
            </p>
          )}
          {error === 'forbidden' && (
            <p className="mb-4 text-sm text-center" style={{ color: '#a3452e' }}>
              This account isn&apos;t authorized to use this app.
            </p>
          )}
          {error === 'maintenance' && (
            <p className="mb-4 text-sm text-center" style={{ color: '#a3452e' }}>
              The app is temporarily offline for maintenance. Please check back shortly.
            </p>
          )}
          <LoginForm />
        </div>

        <p className="text-center text-xs" style={{ color: '#a89d90' }}>
          No password needed — we&apos;ll email you a secure sign-in link.
        </p>
      </div>
    </div>
  )
}
