'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ConnectedAccount {
  platform: string
  username: string | null
}

const PLATFORMS: { key: string; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
]

// Lets a creator connect their own Instagram/Facebook through Zernio's hosted
// OAuth. The button fetches a one-time auth URL and redirects the browser to it;
// Zernio returns to /api/zernio/connect/callback, which maps the account to this
// user.
export function ConnectAccounts({ connected }: { connected: ConnectedAccount[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const byPlatform = new Map(connected.map((c) => [c.platform, c]))

  async function connect(platform: string) {
    setLoading(platform)
    setError(null)
    try {
      const res = await fetch(`/api/zernio/connect/${platform}`)
      const data = (await res.json().catch(() => null)) as { authUrl?: string; error?: string } | null
      if (data?.authUrl) {
        window.location.assign(data.authUrl)
        return
      }
      setError(data?.error ?? 'Could not start the connection. Please try again.')
    } catch {
      setError('Could not start the connection. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Connected accounts</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Link your Instagram and Facebook so your DMs appear in Corvelle.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {PLATFORMS.map(({ key, label }) => {
          const acct = byPlatform.get(key)
          return (
            <div key={key} className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {acct ? `Connected${acct.username ? ` · ${acct.username}` : ''}` : 'Not connected'}
                </p>
              </div>
              <Button
                variant={acct ? 'outline' : 'default'}
                onClick={() => connect(key)}
                disabled={loading !== null}
              >
                {loading === key ? 'Opening…' : acct ? 'Reconnect' : 'Connect'}
              </Button>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  )
}
