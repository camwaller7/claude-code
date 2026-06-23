import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export async function requireAuth() {
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) redirect('/auth/login')
    return session
  } catch {
    redirect('/auth/login')
  }
}
