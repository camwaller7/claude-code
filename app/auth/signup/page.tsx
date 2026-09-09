export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase/server'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { SignupForm } from '@/components/auth/SignupForm'

export default async function SignupPage() {
  // Self-signup exists only in the multi-user trial; in the pilot there's no
  // public signup, so send visitors to the login page.
  if (!multiUserEnabled()) redirect('/auth/login')

  // Already signed in? Straight to the app.
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) redirect('/dashboard')
  } catch {
    // fall through and show the form
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f7f2ec', color: '#2e2621' }}
    >
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center flex flex-col gap-3">
          <Image src="/corvelle-icon.png" alt="Corvelle" width={56} height={56} className="mx-auto rounded-2xl" />
          <h1
            className="text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Create your account
          </h1>
          <p className="text-sm" style={{ color: '#7d746a', maxWidth: '38ch', margin: '0 auto' }}>
            Enter your invite code to get started. Your inbox, brand deals, clients and content — all in one place.
          </p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{ background: '#fffdf9', border: '1px solid #e9dfd2', boxShadow: '0 2px 24px rgba(46, 38, 33, 0.06)' }}
        >
          <SignupForm />
        </div>

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
