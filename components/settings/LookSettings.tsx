'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const THEMES = [
  {
    value: 'playground',
    label: 'Playground',
    desc: 'Bright, playful, social-native',
    chip: 'linear-gradient(135deg, #a855f7, #ec4899)',
    bg: '#fdf1ff',
    fg: '#241a33',
  },
  {
    value: 'studio',
    label: 'Soft Studio',
    desc: 'Warm, calm, boutique',
    chip: 'linear-gradient(135deg, #3f5c50, #b0713f)',
    bg: '#f7f2ec',
    fg: '#2e2621',
  },
  {
    value: 'command',
    label: 'Command',
    desc: 'Dark, precise, all business',
    chip: 'linear-gradient(135deg, #16a34a, #4ade80)',
    bg: '#0c0f14',
    fg: '#dfe6ee',
  },
]

export function LookSettings({ initialTheme }: { initialTheme: string }) {
  const [theme, setTheme] = useState(initialTheme)
  const [saving, setSaving] = useState(false)

  // Apply the selected brand theme to the document as a side effect of the
  // state change (not inside the click handler) so the DOM mutation is React-safe.
  useEffect(() => {
    document.documentElement.dataset.brand = theme
    try { localStorage.setItem('brand_theme', theme) } catch { /* ignore */ }
  }, [theme])

  async function pick(value: string) {
    setTheme(value)
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_theme: value }),
      })
      if (!res.ok) {
        toast.error('Could not save your look — it will reset on other devices')
        return
      }
      toast.success(`Look changed to ${THEMES.find(t => t.value === value)?.label}`)
    } catch {
      toast.error('Could not save your look')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Look &amp; Feel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEMES.map(t => (
            <button
              key={t.value}
              type="button"
              disabled={saving}
              onClick={() => pick(t.value)}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${
                theme === t.value ? 'border-primary scale-[1.02]' : 'border-input hover:border-muted-foreground/40'
              }`}
            >
              {/* mini preview */}
              <div className="mb-2 flex h-16 flex-col justify-between rounded-xl p-2" style={{ background: t.bg }}>
                <div className="h-2 w-1/2 rounded-full" style={{ background: t.chip }} />
                <div className="flex gap-1">
                  <div className="h-4 flex-1 rounded" style={{ background: t.fg, opacity: 0.12 }} />
                  <div className="h-4 flex-1 rounded" style={{ background: t.fg, opacity: 0.12 }} />
                </div>
              </div>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
