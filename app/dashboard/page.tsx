export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow'
import { AudiencePanel } from '@/components/dashboard/AudiencePanel'
import { getContentAnalytics } from '@/lib/analytics/stats'
import { getLinkedPlatforms } from '@/lib/platform/linked'
import { scopedUserId } from '@/lib/auth/currentUser'

export default async function DashboardPage() {
  await requireAuth()
  const supabase = await createServerClient()

  // Multi-user: scope every per-user read to the signed-in user. Null in the
  // single-tenant pilot, where scope() is a no-op.
  const uid = await scopedUserId()
  function scope<T>(q: T): T {
    return uid ? (q as unknown as { eq: (c: string, v: string) => T }).eq('user_id', uid) : q
  }

  const [
    { data: paidDeals },
    { data: pipelineDeals },
    { data: allDeals },
    { data: allConversations },
    { data: allClients },
    { data: allPosts },
    { data: recentMessages },
  ] = await Promise.all([
    scope(supabase.from('deals').select('deal_value, created_at').eq('status', 'paid')),
    scope(supabase.from('deals').select('deal_value, status').in('status', ['inquiry', 'negotiating', 'contracted', 'delivered'])),
    scope(supabase.from('deals').select('status, deal_value, created_at')),
    scope(supabase.from('conversations').select('platform, category, status, last_message_at, created_at')),
    scope(supabase.from('clients').select('status, created_at')),
    scope(supabase.from('posts').select('status, created_at, scheduled_at')),
    scope(supabase.from('messages').select('created_at, direction, conversation:conversations(platform)').order('created_at', { ascending: false }).limit(200)),
  ])

  // Content analytics scoped to this user in multi-user mode (unscoped pilot).
  const [analytics, linkedPlatforms] = await Promise.all([
    getContentAnalytics(uid).catch(() => null),
    getLinkedPlatforms(uid).catch(() => []),
  ])

  // Flatten the embedded conversation platform onto each message row.
  const messages = (recentMessages ?? []).map((m) => {
    const conv = (m as { conversation?: { platform?: string } | { platform?: string }[] }).conversation
    const platform = Array.isArray(conv) ? conv[0]?.platform : conv?.platform
    return { created_at: m.created_at, direction: m.direction, platform: platform ?? null }
  })

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
      recentMessages={messages}
      linkedPlatforms={linkedPlatforms}
    />
    </>
  )
}
