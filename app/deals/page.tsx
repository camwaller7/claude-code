import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Deal, DealStatus } from '@/types'

const stages: { status: DealStatus; label: string }[] = [
  { status: 'inquiry', label: 'Inquiry' },
  { status: 'negotiating', label: 'Negotiating' },
  { status: 'contracted', label: 'Contracted' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'paid', label: 'Paid' },
  { status: 'lost', label: 'Lost' },
]

export default async function DealsPage() {
  const supabase = await createServerClient()
  const { data: deals } = await supabase.from('deals').select('*').order('created_at', { ascending: false })

  const byStatus = (status: DealStatus) => (deals as Deal[] ?? []).filter((d) => d.status === status)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold">Brand Deals</h1>
      </div>
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-w-max">
          {stages.map(({ status, label }) => {
            const cards = byStatus(status)
            return (
              <div key={status} className="w-60 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
                  <span className="text-xs text-zinc-400">{cards.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.map((deal) => (
                    <Card key={deal.id}>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{deal.brand_name}</p>
                        {deal.deal_value && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {deal.currency} {Number(deal.deal_value).toLocaleString()}
                          </p>
                        )}
                        {deal.contact_name && (
                          <p className="text-xs text-zinc-400 mt-1 truncate">{deal.contact_name}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {cards.length === 0 && (
                    <div className="h-16 rounded-lg border-2 border-dashed border-zinc-200" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
