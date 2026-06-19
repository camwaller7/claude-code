import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const [
    { data: paidDeals },
    { data: pipelineDeals },
    { count: totalConvs },
    { count: needsReply },
  ] = await Promise.all([
    supabase.from('deals').select('deal_value').eq('status', 'paid'),
    supabase.from('deals').select('deal_value').in('status', ['negotiating', 'contracted']),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'needs_reply'),
  ])

  const totalRevenue = (paidDeals ?? []).reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0)
  const pipelineValue = (pipelineDeals ?? []).reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0)

  const stats = [
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, description: 'From paid deals' },
    { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, description: 'Negotiating + contracted' },
    { label: 'Total Conversations', value: String(totalConvs ?? 0), description: 'Across all platforms' },
    { label: 'Needs Reply', value: String(needsReply ?? 0), description: 'Awaiting your response' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-zinc-400 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
