import { createServerClient } from '@/lib/supabase/server'
import { MessageThread } from '@/components/inbox/MessageThread'
import { ReplyBox } from '@/components/inbox/ReplyBox'
import type { Conversation, Message } from '@/types'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (!conversation) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })

  const msgList = (messages ?? []) as Message[]
  const lastInbound = [...msgList].reverse().find((m) => m.direction === 'inbound')

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">{conversation.contact_name}</h1>
        <p className="text-sm text-muted-foreground">{conversation.contact_handle} · {conversation.platform}</p>
      </div>
      <MessageThread messages={msgList} conversation={conversation as Conversation} />
      <ReplyBox conversationId={id} suggestedReply={lastInbound?.ai_draft_reply ?? undefined} />
    </div>
  )
}
