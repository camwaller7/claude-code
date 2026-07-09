export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

export default async function SetPasswordPage() {
  let hasSession = false
  let isReset = false
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      if (!isOwnerEmail(data.user.email)) redirect('/auth/login?error=forbidden')
      hasSession = true
      isReset = data.user.user_metadata?.has_password === true
    }
  } catch {
    // fall through
  }
  if (!hasSession) redirect('/auth/login')

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
            🔒
          </span>
          <h1
            className="text-3xl"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            {isReset ? 'Reset your password' : 'Secure your account'}
          </h1>
          <p className="text-sm" style={{ color: '#7d746a', maxWidth: '38ch', margin: '0 auto' }}>
            {isReset
              ? "You're verified — choose a new password."
              : "You're verified — now set a password. You'll use it to sign in from now on."}
          </p>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{ background: '#fffdf9', border: '1px solid #e9dfd2', boxShadow: '0 2px 24px rgba(46, 38, 33, 0.06)' }}
        >
          <SetPasswordForm isReset={isReset} />
        </div>
      </div>
    </div>
  )
}
