import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { MessageThread } from '@/components/inbox/MessageThread'
import { ReplyBox } from '@/components/inbox/ReplyBox'
import { ConversationActions } from '@/components/inbox/ConversationActions'
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
    <div className="flex flex-col gap-4">
      {/* Back button, pinned to the top-left of the page (outside the centered
          conversation column) so it's always the first thing on the screen. */}
      <Link
        href="/inbox"
        aria-label="Back to inbox"
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-background text-foreground hover:bg-accent transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{conv.contact_name}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {conv.contact_handle} · {conv.platform}
            </p>
            <div className="mt-1 flex gap-2">
              <Badge variant="outline">{conv.category.replace('_', ' ')}</Badge>
              {conv.priority > 5 && <Badge variant="destructive">High priority</Badge>}
            </div>
          </div>
          <ConversationActions conversation={conv} />
        </div>
        <MessageThread messages={msgList} conversation={conv} />
        <ReplyBox conversationId={id} suggestedReply={lastInbound?.ai_draft_reply ?? undefined} />
      </div>
    </div>
  )
}
