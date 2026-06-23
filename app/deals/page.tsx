import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { Badge } from '@/components/ui/badge'
import { NewDealDialog } from '@/components/deals/NewDealDialog'
import { DealCard } from '@/components/deals/DealCard'
import type { Deal, DealStatus } from '@/types'

const DEAL_STATUSES: DealStatus[] = ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost']

function statusVariant(status: DealStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'paid') return 'default'
  if (status === 'lost') return 'destructive'
  if (status === 'contracted' || status === 'delivered') return 'secondary'
  return 'outline'
}

export default async function DealsPage() {
  await requireAuth()
  const supabase = await createServerClient()
  const { data: deals } = await supabase.from('deals').select('*').order('created_at', { ascending: false })

  const byStatus = (status: DealStatus) => (deals ?? []).filter((d: Deal) => d.status === status)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground">Track brand deal progress</p>
        </div>
        <NewDealDialog />
      </div>
      <div className="grid grid-cols-3 gap-4 xl:grid-cols-6">
        {DEAL_STATUSES.map((status) => {
          const statusDeals = byStatus(status)
          return (
            <div key={status} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="text-xs text-muted-foreground">{statusDeals.length}</span>
              </div>
              {statusDeals.map((deal: Deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
              {statusDeals.length === 0 && (
                <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
