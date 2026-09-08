export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { currentUserHasFeature } from '@/lib/billing/features'
import { UpgradeNotice } from '@/components/billing/UpgradeNotice'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewClientDialog } from '@/components/clients/NewClientDialog'
import { formatDate } from '@/lib/utils'
import type { CreatorClient } from '@/types'

export default async function ClientsPage() {
  await requireAuth()
  if (!(await currentUserHasFeature('clientPortal'))) {
    return <UpgradeNotice feature="Client portal" />
  }
  const supabase = await createServerClient()
  const uid = await scopedUserId()
  let clientsQuery = supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (uid) clientsQuery = clientsQuery.eq('user_id', uid)
  const { data: clients } = await clientsQuery

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">The people you work with.</p>
        </div>
        <NewClientDialog />
      </div>
      {!clients?.length ? (
        <div className="pt-6">
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Everyone you coach and sell to, in one place. Add your first above."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(clients as CreatorClient[]).map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="transition-colors hover:bg-accent cursor-pointer">
                <CardContent className="p-4">
                  <p className="font-medium text-sm truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{client.handle}</p>
                  {client.product_purchased && (
                    <p className="mt-1 text-xs text-muted-foreground truncate">{client.product_purchased}</p>
                  )}
                  {client.purchase_date && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(client.purchase_date)}
                    </p>
                  )}
                  <div className="mt-2">
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
