'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function NewClientDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    handle: '',
    product_purchased: '',
    purchase_date: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          handle: form.handle,
          product_purchased: form.product_purchased,
          purchase_date: form.purchase_date || null,
          notes: form.notes || null,
        }),
      })
      setOpen(false)
      setForm({ name: '', handle: '', product_purchased: '', purchase_date: '', notes: '' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Client</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handle">Handle / Email</Label>
            <Input
              id="handle"
              value={form.handle}
              onChange={(e) => set('handle', e.target.value)}
              placeholder="@janedoe or jane@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product_purchased">Product purchased</Label>
            <Input
              id="product_purchased"
              value={form.product_purchased}
              onChange={(e) => set('product_purchased', e.target.value)}
              placeholder="1:1 Coaching, Course, etc."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purchase_date">Purchase date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)}
            />
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
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? 'Saving…' : 'Add Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
