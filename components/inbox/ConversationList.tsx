'use client'

import { useRouter } from 'next/navigation'
import type { Conversation } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-10 items-center justify-center rounded bg-muted text-xs font-bold">
              {platformLabel(conv.platform)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{conv.contact_name}</span>
                {conv.priority > 5 && (
                  <span className="h-2 w-2 rounded-full bg-red-500" title="High priority" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{conv.contact_handle}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={categoryVariant(conv.category)}>
              {conv.category.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">{relativeTime(conv.last_message_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
