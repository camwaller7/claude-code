'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Conversation } from '@/types'

export function LinkConversation({ clientId, suggestions }: { clientId: string; suggestions: Conversation[] }) {
  const router = useRouter()
  const [linking, setLinking] = useState<string | null>(null)

  async function link(conversationId: string) {
    setLinking(conversationId)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        toast.error(data?.error ?? 'Could not link conversation')
        return
      }
      toast.success('Conversation linked')
      router.refresh()
    } catch {
      toast.error('Could not link conversation — check your connection')
    } finally {
      setLinking(null)
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 text-center">
        <p className="text-sm text-muted-foreground">
          No linked conversation yet, and nothing in the inbox matches this client&apos;s name or handle.
        </p>
        <p className="text-xs text-muted-foreground">
          Once they message in, reopen this page to link it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <p className="text-sm font-medium">Found a possible match in your inbox</p>
      <p className="text-xs text-muted-foreground">
        Link it so this client&apos;s page becomes the single place you talk to them.
      </p>
      <div className="flex flex-col gap-2 mt-1">
        {suggestions.map(s => (
          <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{s.contact_name}</p>
              <p className="text-xs text-muted-foreground truncate">{s.contact_handle} · {s.platform}</p>
            </div>
            <Button size="sm" onClick={() => link(s.id)} disabled={linking === s.id}>
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {linking === s.id ? 'Linking…' : 'Link'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
