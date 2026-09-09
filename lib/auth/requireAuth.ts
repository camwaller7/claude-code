import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { billingEnabled } from '@/lib/stripe/client'
import { trialModeEnabled } from '@/lib/flags'
import { hasActivePlan } from '@/lib/billing/subscription'
import { auditLog } from '@/lib/audit/log'
import type { Session } from '@supabase/supabase-js'
import { CURRENT_TERMS_VERSION } from '@/lib/auth/termsVersion'

// Re-exported for backward compatibility with existing imports of
// CURRENT_TERMS_VERSION from this module (e.g. app/auth/login/page.tsx).
// The actual value lives in ./termsVersion so client components can
// import it without pulling in this server-only module.
export { CURRENT_TERMS_VERSION }

export async function requireAuth(opts?: { subscription?: boolean }): Promise<Session> {
  let session: Session | null = null
  let forbidden = false
  let needsPassword = false
  let needsTerms = false
  try {
    const supabase = await createServerClient()
    // getUser() re-verifies the JWT against Supabase rather than trusting
  // the cookie payload - getSession() alone is not authoritative.
  const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      // Single-tenant pilot gates to the owner email; multi-user allows any
      // authenticated user. Password + terms gates still apply to everyone.
      if (!multiUserEnabled() && !isOwnerEmail(userData.user.email)) {
        await supabase.auth.signOut()
        forbidden = true
        void auditLog('forbidden_access_attempt', undefined, userData.user.email)
      } else if (userData.user.user_metadata?.has_password !== true) {
        // Signed in via magic link but never set a password - every page
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

  // Multi-user plan gate: users without an active subscription are sent to the
  // billing page (which itself passes subscription:false to avoid a loop). The
  // owner/operator always has access, and the pilot (multi-user off) is exempt.
  if (
    opts?.subscription !== false &&
    multiUserEnabled() &&
    billingEnabled() &&
    !trialModeEnabled() &&
    !isOwnerEmail(session.user.email)
  ) {
    const active = await hasActivePlan(session.user.id).catch(() => false)
    if (!active) redirect('/billing')
  }

  return session
}
