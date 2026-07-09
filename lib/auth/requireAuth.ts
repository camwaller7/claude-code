import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/isOwner'
import type { Session } from '@supabase/supabase-js'

export async function requireAuth(): Promise<Session> {
  let session: Session | null = null
  let forbidden = false
  try {
    const supabase = await createServerClient()
    // getUser() re-verifies the JWT against Supabase rather than trusting
    // the cookie payload — getSession() alone is not authoritative.
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      if (!isOwnerEmail(userData.user.email)) {
        await supabase.auth.signOut()
        forbidden = true
      } else {
        const { data } = await supabase.auth.getSession()
        session = data.session
      }
    }
  } catch (e) {
    console.error('[requireAuth] supabase error:', e)
  }

  if (forbidden) redirect('/auth/login?error=forbidden')
  if (process.env.MAINTENANCE_MODE === 'true') redirect('/auth/login?error=maintenance')
  if (!session) redirect('/auth/login')
  return session
}
