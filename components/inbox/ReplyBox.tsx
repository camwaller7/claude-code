'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface Props {
  conversationId: string
  suggestedReply?: string
}

export function ReplyBox({ conversationId, suggestedReply }: Props) {
  const [body, setBody] = useState(suggestedReply ?? '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    try {
      await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      setSent(true)
      setBody('')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Reply sent. <button className="underline" onClick={() => setSent(false)}>Send another?</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply..."
        rows={4}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !body.trim()}>
          {loading ? 'Sending...' : 'Send Reply'}
        </Button>
      </div>
    </form>
  )
}
