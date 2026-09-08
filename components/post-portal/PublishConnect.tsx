'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Link2, CheckCircle2, Loader2 } from 'lucide-react'

interface Status {
  enabled: boolean
  connected: boolean
  linkedPlatforms: string[]
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  threads: 'Threads',
  tiktok: 'TikTok',
}

// Lets a user connect their own social accounts for publishing via Ayrshare's
// hosted SSO page, and shows which platforms are linked. Publishing (compose +
// "Publish now") only works for platforms shown here as connected.
export function PublishConnect() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    try {
      const res = await fetch('/api/ayrshare/status')
      if (res.ok) setStatus(await res.json())
      else setStatus({ enabled: false, connected: false, linkedPlatforms: [] })
    } catch {
      setStatus({ enabled: false, connected: false, linkedPlatforms: [] })
    }
  }

  useEffect(() => {
    // refresh() only setState()s after an awaited fetch, so this is not the
    // synchronous cascading-render the rule guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    // Re-check when the user returns from the Ayrshare linking tab.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  async function connect() {
    setLoading(true)
    try {
      const res = await fetch('/api/ayrshare/link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Could not open the connection page — try again')
        return
      }
      window.open(data.url, '_blank', 'noopener')
      toast.info('Connect your accounts in the new tab, then come back here.')
    } finally {
      setLoading(false)
    }
  }

  // Ayrshare not configured (e.g. the single-tenant owner publishing via their
  // own direct tokens): render nothing rather than an empty control.
  if (!status || !status.enabled) return null

  return (
    <div className="mb-6 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <p className="font-semibold">Publishing accounts</p>
          </div>
          {status.connected ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {status.linkedPlatforms.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {PLATFORM_LABELS[p] ?? p}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your Instagram, Facebook, X, Threads or TikTok to publish and schedule posts.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={connect} disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Opening…</>
          ) : status.connected ? (
            'Manage accounts'
          ) : (
            'Connect accounts'
          )}
        </Button>
      </div>
    </div>
  )
}
