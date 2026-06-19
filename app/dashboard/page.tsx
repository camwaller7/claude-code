import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`
}

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const [
    { data: paidDeals },
    { data: pipelineDeals },
    { data: allDeals },
    { count: totalConversations },
    { count: needsReply },
    { count: brandDealConvs },
    { count: activeClients },
    { count: publishedPosts },
    { count: scheduledPosts },
  ] = await Promise.all([
    supabase.from('deals').select('deal_value').eq('status', 'paid'),
    supabase.from('deals').select('deal_value').in('status', ['negotiating', 'contracted']),
    supabase.from('deals').select('status'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'needs_reply'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('category', 'brand_deal'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
  ])

  const totalRevenue = (paidDeals ?? []).reduce(
    (sum: number, d: { deal_value: number | null }) => sum + (d.deal_value ?? 0), 0
  )
  const pipelineValue = (pipelineDeals ?? []).reduce(
    (sum: number, d: { deal_value: number | null }) => sum + (d.deal_value ?? 0), 0
  )

  const dealCounts = (allDeals ?? []) as { status: string }[]
  const wonDeals = dealCounts.filter((d) => d.status === 'paid').length
  const closedDeals = dealCounts.filter((d) => ['paid', 'lost'].includes(d.status)).length
  const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100) : null

  const kpis = [
    { title: 'Total Revenue', value: fmt(totalRevenue), sub: 'paid deals' },
    { title: 'Pipeline Value', value: fmt(pipelineValue), sub: 'active deals' },
    { title: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', sub: 'paid vs closed' },
    { title: 'Needs Reply', value: String(needsReply ?? 0), sub: `of ${totalConversations ?? 0} conversations` },
    { title: 'Brand Deal Threads', value: String(brandDealConvs ?? 0), sub: 'in inbox' },
    { title: 'Active Clients', value: String(activeClients ?? 0), sub: 'clients' },
    { title: 'Posts Published', value: String(publishedPosts ?? 0), sub: `${scheduledPosts ?? 0} scheduled` },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Key performance indicators</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
