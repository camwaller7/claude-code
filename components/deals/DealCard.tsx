'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Deal, DealStatus } from '@/types'

const STATUSES: DealStatus[] = ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost']

export function DealCard({ deal }: { deal: Deal }) {
  const router = useRouter()
  const [status, setStatus] = useState<DealStatus>(deal.status)
  const [saving, setSaving] = useState(false)

  async function updateStatus(newStatus: DealStatus) {
    const prev = status
    setStatus(newStatus)
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        setStatus(prev)
        toast.error('Could not update deal — try again')
        return
      }
      if (newStatus === 'paid') {
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 } })
        toast.success(`${deal.brand_name} paid! 🎉`)
      } else {
        toast.success(`Moved to ${newStatus}`)
      }
      router.refresh()
    } catch {
      setStatus(prev)
      toast.error('Could not update deal — check your connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="text-sm">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm truncate">{deal.brand_name}</CardTitle>
        {deal.contact_name && (
          <p className="text-xs text-muted-foreground truncate">{deal.contact_name}</p>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 flex flex-col gap-2">
        {deal.deal_value != null && (
          <p className="font-semibold text-green-600">
            {deal.currency} {deal.deal_value.toLocaleString()}
          </p>
        )}
        {deal.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2">{deal.notes}</p>
        )}
        <Select value={status} onValueChange={(v) => updateStatus(v as DealStatus)} disabled={saving}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {deal.conversation_id && (
          <Link
            href={`/inbox/${deal.conversation_id}`}
            className="flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            View messages
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
