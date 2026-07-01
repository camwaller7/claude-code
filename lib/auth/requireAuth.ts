import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { Session } from '@supabase/supabase-js'

export async function requireAuth(): Promise<Session> {
  let session: Session | null = null
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch (e) {
    console.error('[requireAuth] supabase error:', e)
  }
  if (!session) redirect('/auth/login')
  return session
}
