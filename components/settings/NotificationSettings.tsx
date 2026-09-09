'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, Mail, BellRing, BellOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Channel = 'in_app' | 'email' | 'both' | 'off'

const OPTIONS: { value: Channel; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'in_app', label: 'In-app', desc: 'Dropdown bell only', icon: Bell },
  { value: 'email', label: 'Email', desc: 'Sent to your inbox', icon: Mail },
  { value: 'both', label: 'Both', desc: 'Bell and email', icon: BellRing },
  { value: 'off', label: 'Off', desc: 'No notifications', icon: BellOff },
]

export function NotificationSettings({ initialChannel }: { initialChannel: Channel }) {
  const [channel, setChannel] = useState<Channel>(initialChannel)
  const [saving, setSaving] = useState(false)

  async function pick(value: Channel) {
    const prev = channel
    setChannel(value)
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: value }),
      })
      if (!res.ok) {
        setChannel(prev)
        toast.error('Could not save your notification preference')
        return
      }
      toast.success('Notification preference saved')
    } catch {
      setChannel(prev)
      toast.error('Could not save your notification preference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          How you&apos;d like to hear when a post goes live — including the reminder to add your Instagram
          song, which can only be added in the app after publishing.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OPTIONS.map(({ value, label, desc, icon: Icon }) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => pick(value)}
              className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-all disabled:opacity-60 ${
                channel === value ? 'border-primary scale-[1.02]' : 'border-input hover:border-muted-foreground/40'
              }`}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
