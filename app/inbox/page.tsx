export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { ConversationList } from '@/components/inbox/ConversationList'
import { InboxFilters } from '@/components/inbox/InboxFilters'
import { RealtimeInbox } from '@/components/inbox/RealtimeInbox'
import { Suspense } from 'react'
import { Inbox, Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Conversation } from '@/types'

interface Props {
  searchParams: Promise<{ platform?: string; category?: string; q?: string; status?: string; important?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const { platform, category, q, status, important } = await searchParams
  await requireAuth()
  const supabase = await createServerClient()

  const uid = await scopedUserId()
  // Important conversations always sort to the top, then by recency — so
  // reply-worthy DMs don't get lost among fan/spam messages.
  let query = supabase
    .from('conversations')
    .select('*')
    .order('is_important', { ascending: false })
    .order('last_message_at', { ascending: false })

  if (uid) query = query.eq('user_id', uid)
  if (platform) query = query.eq('platform', platform)
  if (category) query = query.eq('category', category)
  if (important === '1') query = query.eq('is_important', true)
  const effectiveStatus = status ?? 'needs_reply'
  if (effectiveStatus !== 'all') query = query.eq('status', effectiveStatus)
  if (q) {
    const term = q.replace(/[%_]/g, '')
    query = query.or(`contact_name.ilike.%${term}%,contact_handle.ilike.%${term}%`)
  }

  const { data: conversations } = await query

  return (
    <div>
      <RealtimeInbox />
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Every conversation, one place.</p>
      </div>
      <Suspense>
        <InboxFilters />
      </Suspense>
      {!conversations || conversations.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            icon={q ? Search : Inbox}
            title={q ? `No results for “${q}”` : 'All caught up'}
            description={
              q
                ? 'Try a different name or handle.'
                : 'New Instagram and Facebook messages arrive here the moment they land.'
            }
          />
        </div>
      ) : (
        <ConversationList conversations={conversations as Conversation[]} />
      )}
    </div>
  )
}
