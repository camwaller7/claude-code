export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { ConversationList } from '@/components/inbox/ConversationList'
import { InboxFilters } from '@/components/inbox/InboxFilters'
import { RealtimeInbox } from '@/components/inbox/RealtimeInbox'
import { Suspense } from 'react'
import type { Conversation } from '@/types'

interface Props {
  searchParams: Promise<{ platform?: string; category?: string; q?: string; status?: string }>
}

export default async function InboxPage({ searchParams }: Props) {
  const { platform, category, q, status } = await searchParams
  await requireAuth()
  const supabase = await createServerClient()

  const uid = await scopedUserId()
  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  if (uid) query = query.eq('user_id', uid)
  if (platform) query = query.eq('platform', platform)
  if (category) query = query.eq('category', category)
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
        <p className="text-sm text-muted-foreground">All your messages in one place</p>
      </div>
      <Suspense>
        <InboxFilters />
      </Suspense>
      {!conversations || conversations.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed">
          <p className="text-muted-foreground">{q ? `No results for “${q}”` : 'No conversations yet'}</p>
          {q && <p className="text-xs text-muted-foreground">Try a different name or handle</p>}
        </div>
      ) : (
        <ConversationList conversations={conversations as Conversation[]} />
      )}
    </div>
  )
}
