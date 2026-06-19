import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/inbox')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-xl shadow-sm bg-card">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Creator PA</h1>
          <p className="text-sm text-muted-foreground">
            Your unified inbox, CRM, and post portal — all in one place.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
