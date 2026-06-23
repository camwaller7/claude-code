import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { NewClientDialog } from '@/components/clients/NewClientDialog'
import type { CreatorClient } from '@/types'

export default async function ClientsPage() {
  await requireAuth()
  const supabase = await createServerClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Course buyers and coaching clients</p>
        </div>
        <NewClientDialog />
      </div>
      {!clients?.length ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No clients yet — add one above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(clients as CreatorClient[]).map((client) => (
            <Card key={client.id}>
              <CardContent className="p-4">
                <p className="font-medium text-sm">{client.name}</p>
                <p className="text-xs text-muted-foreground">{client.handle}</p>
                {client.product_purchased && (
                  <p className="mt-1 text-xs text-muted-foreground">{client.product_purchased}</p>
                )}
                {client.purchase_date && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(client.purchase_date).toLocaleDateString()}
                  </p>
                )}
                <div className="mt-2">
                  <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                    {client.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
