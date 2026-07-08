'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const EMOJIS = ['✨', '🌟', '🦋', '🌸', '🔥', '💎', '🚀', '🐝', '🌈', '⚡', '🍀', '👑']

const VIBES = [
  { value: 'friendly', label: 'Friendly', desc: 'Warm, encouraging, lots of positivity' },
  { value: 'professional', label: 'Professional', desc: 'Polished and to the point' },
  { value: 'hype', label: 'Hype bestie', desc: 'Your biggest fan — high energy, emojis everywhere' },
  { value: 'chill', label: 'Chill', desc: 'Laid-back, no fuss, keeps it simple' },
]

interface Props {
  initialName: string
  initialEmoji: string
  initialVibe: string
}

export function AssistantSettings({ initialName, initialEmoji, initialVibe }: Props) {
  const [name, setName] = useState(initialName)
  const [emoji, setEmoji] = useState(initialEmoji)
  const [vibe, setVibe] = useState(initialVibe)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant_name: name.trim() || 'Nova', assistant_emoji: emoji, assistant_vibe: vibe }),
    })
    setSaving(false)
    setSaved(true)
    toast.success('Assistant saved')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Preview */}
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl">
            {emoji}
          </div>
          <div>
            <p className="font-semibold text-white">{name.trim() || 'Nova'}</p>
            <p className="text-xs text-white/70">
              {VIBES.find(v => v.value === vibe)?.desc}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assistant-name">Name</Label>
          <Input
            id="assistant-name"
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false) }}
            placeholder="Nova"
            maxLength={20}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Look</Label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { setEmoji(e); setSaved(false) }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all ${
                  emoji === e ? 'border-primary bg-primary/10 scale-110' : 'border-input hover:bg-accent'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Personality</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VIBES.map(v => (
              <button
                key={v.value}
                type="button"
                onClick={() => { setVibe(v.value); setSaved(false) }}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  vibe === v.value ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'
                }`}
              >
                <p className="text-sm font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Assistant'}
        </Button>
      </CardContent>
    </Card>
  )
}
