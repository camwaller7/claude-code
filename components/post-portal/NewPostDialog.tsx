'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Platform } from '@/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'threads', label: 'Threads' },
  { value: 'tiktok', label: 'TikTok' },
]

export function NewPostDialog() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaPreview, setMediaPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setUploadError(data.error ?? 'Upload failed')
        return
      }
      setMediaUrl(data.url)
      setMediaPreview(URL.createObjectURL(file))
    } finally {
      setUploading(false)
    }
  }

  function clearMedia() {
    setMediaUrl('')
    setMediaPreview('')
    setUploadError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) {
      setCaption('')
      setHashtags('')
      clearMedia()
      setSelectedPlatforms([])
      setScheduledAt('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!caption.trim()) return
    setLoading(true)
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          hashtags,
          media_url: mediaUrl || null,
          platforms: selectedPlatforms,
          scheduled_at: scheduledAt || null,
        }),
      })
      handleClose(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>New Post</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#influencer #brand"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePlatform(value)}
                  className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                    selectedPlatforms.includes(value)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Media upload */}
          <div className="flex flex-col gap-1.5">
            <Label>Media (required for Instagram &amp; Threads)</Label>
            {mediaPreview ? (
              <div className="relative">
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="h-40 w-full rounded-md border object-cover"
                />
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                className="flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Click to upload image or video'}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_at">Schedule For (optional)</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploading || !caption.trim()}>
              {loading ? 'Creating...' : scheduledAt ? 'Schedule Post' : 'Save Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
