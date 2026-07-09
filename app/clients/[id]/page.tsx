export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { MessageThread } from '@/components/inbox/MessageThread'
import { ReplyBox } from '@/components/inbox/ReplyBox'
import { ClientProfileEditor } from '@/components/clients/ClientProfileEditor'
import { LinkConversation } from '@/components/clients/LinkConversation'
import { Badge } from '@/components/ui/badge'
import type { CreatorClient, Conversation, Message } from '@/types'

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@/, '')
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  await requireAuth()
  const { id } = await params
  const supabase = await createServerClient()

  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single()
  if (!client) notFound()

  const c = client as CreatorClient

  let conversation: Conversation | null = null
  let messages: Message[] = []
  let suggestedConversations: Conversation[] = []

  if (c.conversation_id) {
    const [{ data: conv }, { data: msgs }] = await Promise.all([
      supabase.from('conversations').select('*').eq('id', c.conversation_id).single(),
      supabase.from('messages').select('*').eq('conversation_id', c.conversation_id).order('sent_at', { ascending: true }),
    ])
    conversation = (conv as Conversation) ?? null
    messages = (msgs as Message[]) ?? []
  } else {
    // No linked conversation yet — offer to link one automatically. Handles
    // get stored inconsistently across platforms ("@name" vs "name",
    // different casing), so match on the normalized form, not an exact
    // string, and also fall back to matching on contact name.
    const { data: allConvs } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(200)
    const targetHandle = normalizeHandle(c.handle)
    const targetName = c.name.trim().toLowerCase()
    suggestedConversations = ((allConvs as Conversation[]) ?? []).filter(conv =>
      normalizeHandle(conv.contact_handle) === targetHandle ||
      conv.contact_name.trim().toLowerCase() === targetName
    )
  }

  const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound')

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{c.name}</h1>
          <p className="text-sm text-muted-foreground truncate">{c.handle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
            {c.product_purchased && <Badge variant="outline">{c.product_purchased}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClientProfileEditor client={c} />

        <div className="flex flex-col gap-3">
          <div>
            <p className="font-semibold">Messages &amp; Interactions</p>
            <p className="text-xs text-muted-foreground">
              This is your only line of contact with {c.name.split(' ')[0]} — every reply goes out from here.
            </p>
          </div>
          {c.conversation_id && conversation ? (
            <>
              <MessageThread messages={messages} conversation={conversation} />
              <ReplyBox conversationId={c.conversation_id} suggestedReply={lastInbound?.ai_draft_reply ?? undefined} />
            </>
          ) : (
            <LinkConversation clientId={c.id} suggestions={suggestedConversations} />
          )}
        </div>
      </div>
    </div>
  )
}
