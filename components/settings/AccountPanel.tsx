'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {})
  }, [])

  async function signOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch {}
    await fetch('/auth/signout', { method: 'POST' }).catch(() => {})
    window.location.href = '/auth/login'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{email ?? 'Signed in'}</p>
          <p className="text-xs text-muted-foreground">Signed in with password</p>
        </div>
        <Button
          variant="outline"
          onClick={signOut}
          disabled={loading}
          className="text-destructive hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loading ? 'Signing out…' : 'Sign out'}
        </Button>
      </CardContent>
    </Card>
  )
}
