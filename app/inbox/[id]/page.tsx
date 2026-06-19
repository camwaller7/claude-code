import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MessageThread } from '@/components/inbox/MessageThread'
import { ReplyBox } from '@/components/inbox/ReplyBox'
import type { Conversation, Message } from '@/types'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ data: conv }, { data: messages }] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', id).single(),
    supabase.from('messages').select('*').eq('conversation_id', id).order('sent_at', { ascending: true }),
  ])

  if (!conv) notFound()

  const lastInbound = [...(messages ?? [])].reverse().find((m: Message) => m.direction === 'inbound')

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h2 className="text-base font-semibold">{conv.contact_name || conv.contact_handle}</h2>
        <p className="text-xs text-zinc-400">{conv.platform} · {conv.contact_handle}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <MessageThread messages={(messages as Message[]) ?? []} conversation={conv as Conversation} />
      </div>
      <div className="border-t border-zinc-200 px-6 py-4">
        <ReplyBox
          conversationId={id}
          suggestedReply={lastInbound?.ai_draft_reply ?? undefined}
        />
      </div>
    </div>
  )
}
