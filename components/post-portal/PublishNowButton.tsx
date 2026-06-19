'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { PostStatus } from '@/types'

export function PublishNowButton({ postId, status }: { postId: string; status: PostStatus }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const disabled = status === 'publishing' || status === 'published'

  async function handlePublish() {
    setLoading(true)
    try {
      await fetch(`/api/posts/${postId}/publish`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (disabled) return null

  return (
    <Button size="sm" variant="outline" onClick={handlePublish} disabled={loading}>
      {loading ? 'Queuing…' : 'Publish now'}
    </Button>
  )
}
