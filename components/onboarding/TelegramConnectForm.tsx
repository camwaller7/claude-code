'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function TelegramConnectForm({ connected }: { connected: boolean }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; bot?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not connect Telegram — please try again.')
        return
      }
      setDone(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        Telegram bot connected. Send it a message to see the chat appear in your inbox.{' '}
        <a className="underline" href="/onboarding">Refresh</a>
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste your bot token from @BotFather"
        autoComplete="off"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={loading || !token.trim()}>
          {loading ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
        </Button>
      </div>
    </form>
  )
}
