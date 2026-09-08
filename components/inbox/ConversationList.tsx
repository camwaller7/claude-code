'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Star } from 'lucide-react'
import type { Conversation, MessageCategory } from '@/types'
import { relativeTime, cn } from '@/lib/utils'

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: 'IG',
    facebook: 'FB',
    x: 'X',
    threads: 'TH',
    tiktok: 'TK',
    gmail: 'GM',
    telegram: 'TG',
  }
  return map[platform] ?? platform.toUpperCase()
}

const CATEGORY_OPTIONS: { value: MessageCategory; label: string }[] = [
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'brand_deal', label: 'Brand deal' },
  { value: 'client', label: 'Client' },
  { value: 'fan', label: 'Fan' },
  { value: 'personal', label: 'Personal' },
  { value: 'spam', label: 'Spam' },
]

interface Props {
  conversations: Conversation[]
}

export function ConversationList({ conversations }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function updateCategory(id: string, category: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleImportant(id: string, next: boolean) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_important: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function deleteConversation(id: string, name: string) {
    const ok = window.confirm(
      `Delete the chat with ${name}? This removes the conversation and its messages from Corvelle. It does not delete anything on the original platform.`
    )
    if (!ok) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => router.push(`/inbox/${conv.id}`)}
          className={cn(
            'flex cursor-pointer items-center justify-between rounded-lg border bg-card p-4 hover:bg-accent transition-colors',
            conv.is_important && 'border-l-4 border-l-amber-400'
          )}
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
          {/* Stop propagation so using these controls doesn't open the chat. */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label={conv.is_important ? 'Unmark important' : 'Mark important'}
              title={conv.is_important ? 'Unmark important' : 'Mark important'}
              disabled={busyId === conv.id}
              onClick={() => toggleImportant(conv.id, !conv.is_important)}
              className={cn(
                'rounded-md p-1 transition-colors disabled:opacity-50',
                conv.is_important
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-muted-foreground hover:text-amber-500'
              )}
            >
              <Star className={cn('h-4 w-4', conv.is_important && 'fill-amber-400')} />
            </button>
            <select
              aria-label="Category"
              title="Categorise this chat"
              value={conv.category}
              disabled={busyId === conv.id}
              onChange={(e) => updateCategory(conv.id, e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {conv.last_message_at ? relativeTime(conv.last_message_at) : ''}
            </span>
            <button
              type="button"
              aria-label="Delete chat"
              title="Delete chat"
              disabled={busyId === conv.id}
              onClick={() => deleteConversation(conv.id, conv.contact_name)}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
