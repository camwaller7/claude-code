'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function ReplyBox({ conversationId, suggestedReply }: { conversationId: string; suggestedReply?: string }) {
  const [body, setBody] = useState(suggestedReply ?? '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSend() {
    if (!body.trim()) return
    setLoading(true)
    try {
      await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      setBody('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply…"
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={loading || !body.trim()} size="sm">
          {loading ? 'Sending…' : 'Send Reply'}
        </Button>
      </div>
    </div>
  )
}
