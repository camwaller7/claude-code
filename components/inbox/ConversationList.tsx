'use client'

import { useRouter } from 'next/navigation'
import type { Conversation } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn, relativeTime } from '@/lib/utils'

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: 'IG',
    facebook: 'FB',
    x: 'X',
    threads: 'TH',
    tiktok: 'TK',
    gmail: 'GM',
  }
  return map[platform] ?? platform.toUpperCase()
}

function categoryVariant(category: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (category === 'brand_deal') return 'default'
  if (category === 'spam') return 'destructive'
  if (category === 'client') return 'secondary'
  return 'outline'
}

interface Props {
  conversations: Conversation[]
}

export function ConversationList({ conversations }: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => router.push(`/inbox/${conv.id}`)}
          className="flex cursor-pointer items-center justify-between rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
              {platformLabel(conv.platform)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{conv.contact_name}</span>
                {conv.priority > 5 && (
                  <span className="h-2 w-2 rounded-full bg-red-500" title="High priority" />
                )}
              </div>
              <span className="block text-xs text-muted-foreground truncate">{conv.contact_handle}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant={categoryVariant(conv.category)}>
              {conv.category.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">{conv.last_message_at ? relativeTime(conv.last_message_at) : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
