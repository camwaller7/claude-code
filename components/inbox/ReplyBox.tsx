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
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? 'Failed to send reply — please try again.')
        return
      }
      setSent(true)
      setBody('')
    } catch {
      setError('Failed to send reply — check your connection and try again.')
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !body.trim()}>
          {loading ? 'Sending...' : 'Send Reply'}
        </Button>
      </div>
    </form>
  )
}
