import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Deal, DealStatus } from '@/types'

const DEAL_STATUSES: DealStatus[] = ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost']

function statusVariant(status: DealStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'paid') return 'default'
  if (status === 'lost') return 'destructive'
  if (status === 'contracted' || status === 'delivered') return 'secondary'
  return 'outline'
}

export default async function DealsPage() {
  const supabase = await createServerClient()
  const { data: deals } = await supabase.from('deals').select('*').order('created_at', { ascending: false })

  const byStatus = (status: DealStatus) => (deals ?? []).filter((d: Deal) => d.status === status)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deals Pipeline</h1>
        <p className="text-sm text-muted-foreground">Track brand deal progress</p>
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
                <Card key={deal.id} className="text-sm">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm">{deal.brand_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    {deal.deal_value != null && (
                      <p className="font-semibold text-green-600">
                        {deal.currency} {deal.deal_value.toLocaleString()}
                      </p>
                    )}
                    <Badge variant={statusVariant(deal.status)} className="mt-1">{deal.status}</Badge>
                  </CardContent>
                </Card>
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
