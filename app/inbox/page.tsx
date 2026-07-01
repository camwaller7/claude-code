export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ConversationList } from '@/components/inbox/ConversationList'
import { InboxFilters } from '@/components/inbox/InboxFilters'
import { RealtimeInbox } from '@/components/inbox/RealtimeInbox'
import { Suspense } from 'react'
import type { Conversation } from '@/types'

interface Props {
  searchParams: Promise<{ platform?: string; category?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const { platform, category } = await searchParams
  await requireAuth()
  const supabase = await createServerClient()

  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  if (platform) query = query.eq('platform', platform)
  if (category) query = query.eq('category', category)

  const { data: conversations } = await query

  return (
    <div>
      <RealtimeInbox />
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">All your messages in one place</p>
      </div>
      <Suspense>
        <InboxFilters />
      </Suspense>
      {!conversations || conversations.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">No conversations yet</p>
        </div>
      ) : (
        <ConversationList conversations={conversations as Conversation[]} />
      )}
    </div>
  )
}
