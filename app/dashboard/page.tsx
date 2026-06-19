import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const [
    { data: paidDeals },
    { data: pipelineDeals },
    { count: totalConversations },
    { count: needsReply },
  ] = await Promise.all([
    supabase.from('deals').select('deal_value').eq('status', 'paid'),
    supabase.from('deals').select('deal_value').in('status', ['negotiating', 'contracted']),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'needs_reply'),
  ])

  const totalRevenue = (paidDeals ?? []).reduce((sum: number, d: { deal_value: number | null }) => sum + (d.deal_value ?? 0), 0)
  const pipelineValue = (pipelineDeals ?? []).reduce((sum: number, d: { deal_value: number | null }) => sum + (d.deal_value ?? 0), 0)

  const stats = [
    { title: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}` },
    { title: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}` },
    { title: 'Total Conversations', value: totalConversations ?? 0 },
    { title: 'Needs Reply', value: needsReply ?? 0 },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your key performance indicators</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
