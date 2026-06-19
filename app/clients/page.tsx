import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { CreatorClient } from '@/types'

export default async function ClientsPage() {
  const supabase = await createServerClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold">Clients</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {!clients?.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
            <p className="text-sm">No clients yet</p>
            <p className="text-xs mt-1">Tag a conversation as a client to add them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(clients as CreatorClient[]).map((client) => (
              <Card key={client.id}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{client.name}</p>
                  <p className="text-xs text-zinc-400">{client.handle}</p>
                  <p className="text-xs text-zinc-500 mt-1">{client.product_purchased}</p>
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
    </div>
  )
}
