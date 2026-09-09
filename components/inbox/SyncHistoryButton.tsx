'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { History, Loader2 } from 'lucide-react'

// Pulls full DM history (and media) from Zernio. Fires the debounced auto-backfill
// once on mount (so history quietly fills in on login), and offers a manual
// "Sync history" that forces a fresh pull on demand.
export function SyncHistoryButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const autoFired = useRef(false)

  useEffect(() => {
    if (autoFired.current) return
    autoFired.current = true
    // Debounced server-side to once/day — safe to call on every load.
    fetch('/api/zernio/inbox/backfill', { method: 'POST' })
      .then(r => r.json())
      .then((d: { skipped?: boolean; conversations?: number; messages?: number }) => {
        if (!d.skipped && (d.messages ?? 0) > 0) router.refresh()
      })
      .catch(() => {})
  }, [router])

  async function syncNow() {
    setBusy(true)
    try {
      const res = await fetch('/api/zernio/inbox/backfill?force=1', { method: 'POST' })
      if (!res.ok) {
        toast.error(`Could not sync history (${res.status}) — try again in a moment`)
        return
      }
      const d = (await res.json()) as { skipped?: boolean; reason?: string; conversations?: number; messages?: number }
      if (d.skipped) {
        toast.error(
          d.reason === 'zernio_disabled'
            ? 'Messaging provider not connected'
            : `Could not sync history${d.reason ? `: ${d.reason}` : ''}`
        )
        return
      }
      toast.success(`History synced — ${d.conversations ?? 0} conversations, ${d.messages ?? 0} messages`)
      router.refresh()
    } catch {
      toast.error('Could not sync history')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={syncNow}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-60"
      title="Pull your full message history and media from connected accounts"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
      {busy ? 'Syncing…' : 'Sync history'}
    </button>
  )
}
