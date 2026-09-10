'use client'

import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { Message, MessageAttachment, Conversation } from '@/types'
import { cn, formatTime } from '@/lib/utils'

// The app to send the viewer to for content Meta only serves inside its own app.
function appName(platform: string): string {
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'facebook') return 'Facebook'
  if (platform === 'threads') return 'Threads'
  return 'the'
}

// Zernio-hosted media needs the API key, so route it through our authenticated
// proxy; other (public) URLs load directly.
function mediaSrc(url: string): string {
  try {
    const h = new URL(url).hostname
    if (h === 'zernio.com' || h.endsWith('.zernio.com')) return `/api/media?url=${encodeURIComponent(url)}`
  } catch { /* fall through */ }
  return url
}

function normalizeType(type: string): 'image' | 'video' | 'audio' | 'share' | 'file' {
  const t = type.toLowerCase()
  if (t.includes('image') || t === 'sticker' || t === 'photo') return 'image'
  if (t.includes('video') || t === 'reel' || t === 'gif') return 'video'
  if (t.includes('audio') || t === 'voice') return 'audio'
  if (t === 'share' || t === 'story_mention' || t === 'post') return 'share'
  return 'file'
}

// Shown when we can't render the media itself — a shared post/story (Meta only
// serves those inside its own app), or a photo/video whose link has expired.
// Makes it clear it's a platform limitation, not the app being broken.
function MediaPlaceholder({ label, platform }: { label: string; platform: string }) {
  return (
    <div className="flex max-w-[16rem] items-center gap-2.5 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
      <ImageOff className="h-4 w-4 shrink-0" />
      <span>{label} — only viewable in the {appName(platform)} app</span>
    </div>
  )
}

function Attachment({ attachment, platform }: { attachment: MessageAttachment; platform: string }) {
  const [failed, setFailed] = useState(false)
  const kind = normalizeType(attachment.type)
  const src = attachment.url ? mediaSrc(attachment.url) : ''

  // Shared posts / stories / mentions are references to content on the platform
  // that Meta does not serve to us — and any attachment without a media URL —
  // always render as a friendly placeholder rather than a blank/broken tile.
  if (kind === 'share' || !src) {
    const label =
      kind === 'share' ? 'Shared post or story'
      : kind === 'video' ? 'Video'
      : kind === 'image' ? 'Photo'
      : 'Media'
    return <MediaPlaceholder label={label} platform={platform} />
  }

  // eslint-disable-next-line @next/next/no-img-element
  if (kind === 'image' && !failed) return <img src={src} alt="attachment" className="max-h-64 rounded-lg" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  if (kind === 'video' && !failed) return <video src={src} controls className="max-h-64 rounded-lg" onError={() => setFailed(true)} />
  if (kind === 'audio' && !failed) return <audio src={src} controls className="w-56" onError={() => setFailed(true)} />

  // Reached only when the media failed to load (e.g. an expired CDN link) or a
  // generic file we can't inline — show the placeholder so it never looks broken.
  const label = kind === 'video' ? 'Video' : kind === 'image' ? 'Photo' : kind === 'audio' ? 'Voice message' : 'Attachment'
  return <MediaPlaceholder label={label} platform={platform} />
}

interface Props {
  messages: Message[]
  conversation: Conversation
}

function MessageBubble({ message, platform }: { message: Message; platform: string }) {
  const isOutbound = message.direction === 'outbound'
  const [showDraft, setShowDraft] = useState(false)

  const attachments = message.attachments ?? []

  return (
    <div className={cn('flex flex-col gap-1', isOutbound ? 'items-end' : 'items-start')}>
      {/* Media attachments (images, video, voice notes, shared posts). */}
      {attachments.length > 0 && (
        <div className={cn('flex max-w-[70%] flex-col gap-1.5', isOutbound ? 'items-end' : 'items-start')}>
          {attachments.map((a, i) => (
            <Attachment key={i} attachment={a} platform={platform} />
          ))}
        </div>
      )}
      {/* Text bubble — skip it entirely for media-only messages so there's no
          empty grey bubble. */}
      {message.body?.trim() && (
        <div
          className={cn(
            'max-w-[70%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap break-words',
            isOutbound
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          )}
        >
          {message.body}
        </div>
      )}
      {!isOutbound && message.ai_draft_reply && (
        <div className="max-w-[70%]">
          <button
            onClick={() => setShowDraft(!showDraft)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {showDraft ? 'Hide' : 'Show'} AI suggested reply
          </button>
          {showDraft && (
            <div className="mt-1 rounded border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {message.ai_draft_reply}
            </div>
          )}
        </div>
      )}
      {message.sent_at && (
        <span className="text-xs text-muted-foreground">
          {formatTime(message.sent_at)}
        </span>
      )}
    </div>
  )
}

export function MessageThread({ messages, conversation }: Props) {
  // Open the thread scrolled to the most recent message (chat convention),
  // rather than at the oldest one. Jump instantly on load; smooth-scroll when
  // new messages arrive in the same view.
  const bottomRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)
  useEffect(() => {
    if (messages.length === 0) return
    // Defer past the App Router's post-navigation scroll-to-top reset (which
    // runs after this effect), otherwise it clobbers our scroll and the thread
    // opens at the oldest message. Two rAFs land us after layout + that reset.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          block: 'end',
          behavior: didInitialScroll.current ? 'smooth' : 'auto',
        })
        didInitialScroll.current = true
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No messages yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      {messages.map((message, i) => {
        const prev = messages[i - 1]
        // Insert a day divider whenever the calendar day changes (or before the
        // first message), so threads spanning multiple days are easy to follow.
        const showDivider = !prev || !sameDay(prev.sent_at, message.sent_at)
        return (
          <div key={message.id} className="flex flex-col gap-4">
            {showDivider && message.sent_at && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">{dayLabel(message.sent_at)}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <MessageBubble message={message} platform={conversation.platform} />
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

// True when two ISO timestamps fall on the same calendar day.
function sameDay(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// "Today" / "Yesterday" / a full date for the day divider.
function dayLabel(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(ts, today.toISOString())) return 'Today'
  if (sameDay(ts, yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}
