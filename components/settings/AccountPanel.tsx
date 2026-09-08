'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LogOut, Download, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AccountPanel() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function exportData() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        toast.error('Could not export your data — try again')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'corvelle-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Permanently delete your account and all your data? This cannot be undone.'
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Could not delete your account — try again')
        return
      }
      await supabase.auth.signOut().catch(() => {})
      window.location.href = '/auth/login'
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
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
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium">Your data</p>
          <p className="text-xs text-muted-foreground">
            Download everything we hold for you, or permanently delete your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Preparing…' : 'Export my data'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deleteAccount}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
