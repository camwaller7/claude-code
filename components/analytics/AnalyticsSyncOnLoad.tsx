'use client'

import { useEffect } from 'react'

// Fires a per-user analytics refresh when the authenticated app loads (i.e. on
// login / first paint of the shell). Fire-and-forget: the server route is
// debounced to once per 15 minutes per user, so reloads are cheap and this never
// blocks the UI. The daily cron still runs independently.
export function AnalyticsSyncOnLoad() {
  useEffect(() => {
    fetch('/api/zernio/insights/self', { method: 'POST', keepalive: true }).catch(() => {})
  }, [])
  return null
}
