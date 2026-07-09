'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { CreatorClient } from '@/types'

export function ClientProfileEditor({ client }: { client: CreatorClient }) {
  const [form, setForm] = useState({
    age: client.age?.toString() ?? '',
    gender: client.gender ?? '',
    job_title: client.job_title ?? '',
    location: client.location ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    goals: client.goals ?? '',
    preferences: client.preferences ?? '',
    important_dates: client.important_dates ?? '',
    ai_context: client.ai_context ?? '',
    notes: client.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: form.age ? parseInt(form.age, 10) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        toast.error(data?.error ?? 'Could not save client profile')
        return
      }
      toast.success('Client profile saved')
    } catch {
      toast.error('Could not save — check your connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Profile</CardTitle>
        <p className="text-xs text-muted-foreground">
          Everything here helps you (and your AI assistant) give {client.name.split(' ')[0]} top-notch, personal service.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label>Age</Label>
            <Input type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="—" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Gender</Label>
            <Input value={form.gender} onChange={e => set('gender', e.target.value)} placeholder="—" />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Job / role</Label>
            <Input value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="—" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="—" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="—" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Goals</Label>
          <Textarea rows={2} value={form.goals} onChange={e => set('goals', e.target.value)} placeholder="What is this client trying to achieve?" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Preferences &amp; communication style</Label>
          <Textarea rows={2} value={form.preferences} onChange={e => set('preferences', e.target.value)} placeholder="How do they like to be spoken to? Any likes/dislikes?" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Important dates</Label>
          <Textarea rows={2} value={form.important_dates} onChange={e => set('important_dates', e.target.value)} placeholder="Birthdays, renewal dates, milestones..." />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>General notes</Label>
          <Textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything else worth remembering" />
        </div>

        <div className="flex flex-col gap-1.5 rounded-xl border border-dashed p-3">
          <Label className="flex items-center gap-1.5">
            <span>Brief for your AI assistant</span>
            <span className="text-xs font-normal text-muted-foreground">— it reads this before drafting replies</span>
          </Label>
          <Textarea
            rows={3}
            value={form.ai_context}
            onChange={e => set('ai_context', e.target.value)}
            placeholder="e.g. 'Prefers short, upbeat replies. Struggling with consistency, not confidence. Don't mention pricing unless asked.'"
          />
        </div>

        <Button onClick={save} disabled={saving} className="self-start">
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </CardContent>
    </Card>
  )
}
