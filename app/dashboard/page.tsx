export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow'
import { AudiencePanel } from '@/components/dashboard/AudiencePanel'
import { getContentAnalytics } from '@/lib/analytics/stats'

export default async function DashboardPage() {
  await requireAuth()
  const supabase = await createServerClient()

  const [
    { data: paidDeals },
    { data: pipelineDeals },
    { data: allDeals },
    { data: allConversations },
    { data: allClients },
    { data: allPosts },
    { data: recentMessages },
  ] = await Promise.all([
    supabase.from('deals').select('deal_value, created_at').eq('status', 'paid'),
    supabase.from('deals').select('deal_value, status').in('status', ['inquiry', 'negotiating', 'contracted', 'delivered']),
    supabase.from('deals').select('status, deal_value, created_at'),
    supabase.from('conversations').select('category, status, last_message_at, created_at'),
    supabase.from('clients').select('status, created_at'),
    supabase.from('posts').select('status, created_at, scheduled_at'),
    supabase.from('messages').select('created_at, direction').order('created_at', { ascending: false }).limit(200),
  ])

  const analytics = await getContentAnalytics().catch(() => null)

  return (
    <>
    <WelcomeFlow />
    {analytics && (
      <div className="max-w-6xl mx-auto w-full pb-6">
        <AudiencePanel analytics={analytics} />
      </div>
    )}
    <DashboardClient
      paidDeals={paidDeals ?? []}
      pipelineDeals={pipelineDeals ?? []}
      allDeals={allDeals ?? []}
      allConversations={allConversations ?? []}
      allClients={allClients ?? []}
      allPosts={allPosts ?? []}
      recentMessages={recentMessages ?? []}
    />
    </>
  )
}
