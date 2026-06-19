'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DealStatus } from '@/types'

const STATUSES: DealStatus[] = ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost']

export function NewDealDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    brand_name: '',
    contact_name: '',
    deal_value: '',
    currency: 'USD',
    status: 'inquiry' as DealStatus,
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brand_name.trim()) return
    setLoading(true)
    try {
      await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: form.brand_name,
          contact_name: form.contact_name,
          deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
          currency: form.currency,
          status: form.status,
          notes: form.notes || null,
        }),
      })
      setOpen(false)
      setForm({ brand_name: '', contact_name: '', deal_value: '', currency: 'USD', status: 'inquiry', notes: '' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Deal</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Brand Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand_name">Brand *</Label>
            <Input
              id="brand_name"
              value={form.brand_name}
              onChange={(e) => set('brand_name', e.target.value)}
              placeholder="Nike, Gymshark…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact_name">Contact name</Label>
            <Input
              id="contact_name"
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="deal_value">Value</Label>
              <Input
                id="deal_value"
                type="number"
                min="0"
                step="0.01"
                value={form.deal_value}
                onChange={(e) => set('deal_value', e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                placeholder="USD"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Stage</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any details…"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.brand_name.trim()}>
              {loading ? 'Saving…' : 'Add Deal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
