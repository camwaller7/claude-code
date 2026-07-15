import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import { auditLog } from '@/lib/audit/log'
import type { Session } from '@supabase/supabase-js'

// Bump this if the Terms/Privacy content materially changes and existing
// users need to re-accept — compared against user_metadata.terms_accepted_version.
export const CURRENT_TERMS_VERSION = 1

export async function requireAuth(): Promise<Session> {
  let session: Session | null = null
  let forbidden = false
  let needsPassword = false
  let needsTerms = false
  try {
    const supabase = await createServerClient()
    // getUser() re-verifies the JWT against Supabase rather than trusting
    // the cookie payload — getSession() alone is not authoritative.
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      if (!isOwnerEmail(userData.user.email)) {
        await supabase.auth.signOut()
        forbidden = true
        void auditLog('forbidden_access_attempt', undefined, userData.user.email)
      } else if (userData.user.user_metadata?.has_password !== true) {
        // Signed in via magic link but never set a password — every page
        // must force that step before granting access, not just the login
        // redirect, or a direct URL visit would bypass it.
        needsPassword = true
      } else if (userData.user.user_metadata?.terms_accepted_version !== CURRENT_TERMS_VERSION) {
        // Same reasoning as the password gate: must be enforced on every
        // page, not just at login, so a direct URL visit can't skip it.
        needsTerms = true
      } else {
        const { data } = await supabase.auth.getSession()
        session = data.session
      }
    }
  } catch (e) {
    console.error('[requireAuth] supabase error:', e)
  }

  if (forbidden) redirect('/auth/login?error=forbidden')
  if (needsPassword) redirect('/auth/set-password')
  if (needsTerms) redirect('/auth/accept-terms')
  if (process.env.MAINTENANCE_MODE === 'true') redirect('/auth/login?error=maintenance')
  if (!session) redirect('/auth/login')
  return session
}
