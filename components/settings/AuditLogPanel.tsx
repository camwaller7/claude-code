'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, ShieldCheck, KeyRound, Settings2, Briefcase, Link2, Bot, FileCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Entry {
  id: string
  actor_email: string | null
  action: string
  detail: Record<string, unknown> | null
  created_at: string
}

const ICONS: Record<string, React.ElementType> = {
  sign_in: ShieldCheck,
  sign_in_failed: ShieldAlert,
  forbidden_access_attempt: ShieldAlert,
  password_set: KeyRound,
  password_reset: KeyRound,
  terms_accepted: FileCheck,
  platform_connected: Link2,
  settings_changed: Settings2,
  deal_status_changed: Briefcase,
  deal_created: Briefcase,
  client_updated: Briefcase,
  ai_action: Bot,
}

const LABELS: Record<string, string> = {
  sign_in: 'Signed in',
  sign_in_failed: 'Failed sign-in attempt',
  forbidden_access_attempt: 'Blocked: non-owner tried to access the app',
  password_set: 'Password set',
  password_reset: 'Password reset',
  terms_accepted: 'Terms of Service & Privacy Policy accepted',
  platform_connected: 'Social platform connected',
  settings_changed: 'Settings changed',
  deal_status_changed: 'Deal status changed (via AI)',
  deal_created: 'Deal created (via AI)',
  client_updated: 'Client profile updated',
  ai_action: 'AI assistant action',
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/audit-log')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.entries)) setEntries(data.entries)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Activity</CardTitle>
        <p className="text-xs text-muted-foreground">Sign-ins, password changes, and sensitive actions — last 50</p>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">Could not load security activity — try refreshing the page.</p>
        ) : entries === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {entries.map(e => {
              const Icon = ICONS[e.action] ?? ShieldCheck
              const isWarning = e.action === 'sign_in_failed' || e.action === 'forbidden_access_attempt'
              return (
                <div key={e.id} className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isWarning ? 'text-red-500' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={isWarning ? 'text-red-600 dark:text-red-400' : ''}>{LABELS[e.action] ?? e.action}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.actor_email ?? 'unknown'} · {formatDate(e.created_at, { withTime: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
