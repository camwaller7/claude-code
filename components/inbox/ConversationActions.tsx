'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Conversation, DealStatus } from '@/types'

const DEAL_STATUSES: DealStatus[] = ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost']

interface Props {
  conversation: Conversation
}

export function ConversationActions({ conversation }: Props) {
  const router = useRouter()

  // Deal dialog
  const [dealOpen, setDealOpen] = useState(false)
  const [dealForm, setDealForm] = useState({
    brand_name: conversation.contact_name,
    contact_name: conversation.contact_name,
    deal_value: '',
    currency: 'USD',
    status: 'inquiry' as DealStatus,
  })
  const [dealLoading, setDealLoading] = useState(false)

  // Client dialog
  const [clientOpen, setClientOpen] = useState(false)
  const [clientForm, setClientForm] = useState({
    name: conversation.contact_name,
    handle: conversation.contact_handle,
    product_purchased: '',
    purchase_date: '',
  })
  const [clientLoading, setClientLoading] = useState(false)

  async function createDeal(e: React.FormEvent) {
    e.preventDefault()
    setDealLoading(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: dealForm.brand_name,
          contact_name: dealForm.contact_name,
          deal_value: dealForm.deal_value ? parseFloat(dealForm.deal_value) : null,
          currency: dealForm.currency,
          status: dealForm.status,
          conversation_id: conversation.id,
        }),
      })
      if (!res.ok) {
        toast.error('Could not create deal — try again')
        return
      }
      toast.success('Deal created from conversation')
      setDealOpen(false)
      router.push('/deals')
    } finally {
      setDealLoading(false)
    }
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault()
    setClientLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clientForm.name,
          handle: clientForm.handle,
          product_purchased: clientForm.product_purchased,
          purchase_date: clientForm.purchase_date || null,
          conversation_id: conversation.id,
        }),
      })
      if (!res.ok) {
        toast.error('Could not add client — try again')
        return
      }
      toast.success('Client added from conversation')
      setClientOpen(false)
      router.push('/clients')
    } finally {
      setClientLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}>
          Convert to Deal
        </Button>
        <Button size="sm" variant="outline" onClick={() => setClientOpen(true)}>
          Mark as Client
        </Button>
      </div>

      {/* Deal dialog */}
      <Dialog open={dealOpen} onOpenChange={setDealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Deal from Conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={createDeal} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-brand">Brand name</Label>
              <Input
                id="d-brand"
                value={dealForm.brand_name}
                onChange={(e) => setDealForm((p) => ({ ...p, brand_name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-contact">Contact name</Label>
              <Input
                id="d-contact"
                value={dealForm.contact_name}
                onChange={(e) => setDealForm((p) => ({ ...p, contact_name: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="d-value">Value</Label>
                <Input
                  id="d-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealForm.deal_value}
                  onChange={(e) => setDealForm((p) => ({ ...p, deal_value: e.target.value }))}
                  placeholder="5000"
                />
              </div>
              <div className="flex w-24 flex-col gap-1.5">
                <Label htmlFor="d-currency">Currency</Label>
                <Input
                  id="d-currency"
                  value={dealForm.currency}
                  onChange={(e) => setDealForm((p) => ({ ...p, currency: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Stage</Label>
              <Select
                value={dealForm.status}
                onValueChange={(v) => setDealForm((p) => ({ ...p, status: v as DealStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDealOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={dealLoading}>
                {dealLoading ? 'Creating…' : 'Create Deal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client dialog */}
      <Dialog open={clientOpen} onOpenChange={setClientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add as Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={createClient} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={clientForm.name}
                onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-handle">Handle / Email</Label>
              <Input
                id="c-handle"
                value={clientForm.handle}
                onChange={(e) => setClientForm((p) => ({ ...p, handle: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-product">Product purchased</Label>
              <Input
                id="c-product"
                value={clientForm.product_purchased}
                onChange={(e) => setClientForm((p) => ({ ...p, product_purchased: e.target.value }))}
                placeholder="1:1 Coaching, Course…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-date">Purchase date</Label>
              <Input
                id="c-date"
                type="date"
                value={clientForm.purchase_date}
                onChange={(e) => setClientForm((p) => ({ ...p, purchase_date: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setClientOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={clientLoading}>
                {clientLoading ? 'Saving…' : 'Add Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
