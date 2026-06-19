import { createServerClient } from '@/lib/supabase/server'
import { ConversationList } from '@/components/inbox/ConversationList'
import type { Conversation } from '@/types'

export default async function InboxPage() {
  const supabase = createServerClient()
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">All your messages in one place</p>
      </div>
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
