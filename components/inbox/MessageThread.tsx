'use client'

import { useState } from 'react'
import type { Message, Conversation } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  messages: Message[]
  conversation: Conversation
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  const [showDraft, setShowDraft] = useState(false)

  return (
    <div className={cn('flex flex-col gap-1', isOutbound ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2 text-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {message.body}
      </div>
      {!isOutbound && message.ai_draft_reply && (
        <div className="max-w-[70%]">
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {showDraft ? 'Hide' : 'Show'} AI suggested reply
          </button>
          {showDraft && (
            <div className="mt-1 rounded border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {message.ai_draft_reply}
            </div>
          )}
        </div>
      )}
      {message.sent_at && (
        <span className="text-xs text-muted-foreground">
          {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

export function MessageThread({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No messages yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  )
}
