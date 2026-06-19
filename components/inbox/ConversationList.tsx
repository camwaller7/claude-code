'use client'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/utils'
import type { Conversation, MessageCategory } from '@/types'

const platformLabel: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  x: 'X',
  gmail: 'GM',
  threads: 'TH',
  tiktok: 'TT',
}

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
        <p className="text-sm">No messages yet</p>
        <p className="text-xs mt-1">Connect your accounts to start seeing messages here</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <Link
            href={`/inbox/${conv.id}`}
            className="flex items-start gap-3 px-6 py-4 hover:bg-zinc-50 transition-colors"
          >
            <span className="mt-0.5 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
              {platformLabel[conv.platform] ?? conv.platform}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{conv.contact_name || conv.contact_handle}</span>
                <span className="text-xs text-zinc-400 shrink-0">
                  {conv.last_message_at ? relativeTime(conv.last_message_at) : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={conv.category as MessageCategory}>{conv.category.replace('_', ' ')}</Badge>
                {conv.status === 'needs_reply' && (
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" title="Needs reply" />
                )}
                {conv.priority >= 7 && (
                  <span className="text-xs text-orange-500 font-medium">High priority</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
