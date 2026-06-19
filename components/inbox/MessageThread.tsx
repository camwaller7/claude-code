'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Conversation, Message } from '@/types'

export function MessageThread({ messages, conversation: _conversation }: { messages: Message[]; conversation: Conversation }) {
  if (messages.length === 0) {
    return <p className="text-sm text-zinc-400 text-center py-8">No messages yet</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)
  const isOutbound = message.direction === 'outbound'

  return (
    <div className={cn('flex flex-col gap-1 max-w-[80%]', isOutbound ? 'self-end items-end' : 'self-start items-start')}>
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isOutbound ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
        )}
      >
        {message.body}
      </div>
      {!isOutbound && message.ai_draft_reply && (
        <div className="text-xs text-zinc-400">
          <button onClick={() => setExpanded(!expanded)} className="underline-offset-2 hover:underline">
            {expanded ? 'Hide' : 'Show'} AI suggestion
          </button>
          {expanded && (
            <div className="mt-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600 max-w-xs">
              {message.ai_draft_reply}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
