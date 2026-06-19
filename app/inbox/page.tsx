import { createServerClient } from '@/lib/supabase/server'
import { ConversationList } from '@/components/inbox/ConversationList'
import type { Conversation } from '@/types'

export default async function InboxPage() {
  const supabase = await createServerClient()
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold">Inbox</h1>
        <span className="text-sm text-zinc-500">
          {conversations?.filter((c: Conversation) => c.status === 'needs_reply').length ?? 0} need reply
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConversationList conversations={(conversations as Conversation[]) ?? []} />
      </div>
    </div>
  )
}
