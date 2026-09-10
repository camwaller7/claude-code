import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { MessageThread } from '@/components/inbox/MessageThread'
import { ReplyBox } from '@/components/inbox/ReplyBox'
import { ConversationActions } from '@/components/inbox/ConversationActions'
import { ContactAvatar } from '@/components/inbox/ContactAvatar'
import { Badge } from '@/components/ui/badge'
import type { Conversation, Message } from '@/types'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  await requireAuth()
  const { id } = await params
  const supabase = await createServerClient()

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

  const conv = conversation as Conversation

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Sticky contact header — who you're replying to (name, @handle) and the
          convert-to-deal/client actions stay pinned to the top no matter how far
          you scroll a long thread. */}
      <div className="sticky top-0 z-20 flex items-center gap-3 rounded-xl border bg-background/90 px-3 py-2.5 shadow-sm backdrop-blur">
        <Link
          href="/inbox"
          aria-label="Back to inbox"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <ContactAvatar avatar={conv.contact_avatar} platform={conv.platform} name={conv.contact_name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">{conv.contact_name}</h1>
            {conv.priority > 5 && <Badge variant="destructive" className="shrink-0">High</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conv.contact_handle ? `${conv.contact_handle} · ` : ''}
            <span className="capitalize">{conv.platform}</span>
            {' · '}
            <span className="capitalize">{conv.category.replace('_', ' ')}</span>
          </p>
        </div>
        <ConversationActions conversation={conv} />
      </div>
      <MessageThread messages={msgList} conversation={conv} />
      <ReplyBox conversationId={id} suggestedReply={lastInbound?.ai_draft_reply ?? undefined} />
    </div>
  )
}
