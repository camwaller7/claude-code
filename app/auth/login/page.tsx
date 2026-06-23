export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'

type Props = { searchParams: Promise<{ error?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  console.log('[login] SUPABASE_URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[login] SUPABASE_ANON_KEY set:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  try {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session) redirect('/inbox')
  } catch (e) {
    console.error('[login] supabase error:', e)
  }

  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-xl shadow-sm bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Creator PA</h1>
          <p className="text-sm text-muted-foreground">
            Your unified inbox, CRM, and post portal — all in one place.
          </p>
        </div>
        {error === 'auth' && (
          <p className="text-sm text-destructive text-center">Sign-in failed. Please try again.</p>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
