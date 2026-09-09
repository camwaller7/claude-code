export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { CURRENT_TERMS_VERSION } from '@/lib/auth/requireAuth'

type Props = { searchParams: Promise<{ error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  let redirectTo: string | null = null
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      if (data.user.user_metadata?.has_password !== true) {
        redirectTo = '/auth/set-password'
      } else if (data.user.user_metadata?.terms_accepted_version !== CURRENT_TERMS_VERSION) {
        redirectTo = '/auth/accept-terms'
      } else {
        redirectTo = '/dashboard'
      }
    }
  } catch (e) {
    console.error('[login] supabase error:', e)
  }
  if (redirectTo) redirect(redirectTo)

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
          <Image
            src="/corvelle-icon.png"
            alt="Corvelle"
            width={56}
            height={56}
            className="mx-auto rounded-2xl"
          />
          <h1
            className="text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Corvelle
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

        {multiUserEnabled() ? (
          <p className="text-center text-xs" style={{ color: '#a89d90' }}>
            Have an invite code?{' '}
            <a href="/auth/signup" className="underline">Create your account</a>.
          </p>
        ) : (
          <p className="text-center text-xs" style={{ color: '#a89d90' }}>
            First time here? Use a sign-in link to verify your email, then set a password.
          </p>
        )}

        <p className="text-center text-xs" style={{ color: '#a89d90' }}>
          <a href="/privacy" className="underline">Privacy Policy</a>
          {' · '}
          <a href="/terms" className="underline">Terms of Service</a>
          {' · '}
          <a href="/data-deletion" className="underline">Data Deletion</a>
        </p>
      </div>
    </div>
  )
}
