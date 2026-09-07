'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import type { Message, MessageAttachment, Conversation } from '@/types'
import { cn, formatTime } from '@/lib/utils'

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

function Attachment({ attachment }: { attachment: MessageAttachment }) {
  const kind = normalizeType(attachment.type)
  const src = mediaSrc(attachment.url)
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="attachment" className="max-h-64 rounded-lg" />
  }
  if (kind === 'video') {
    return <video src={src} controls className="max-h-64 rounded-lg" />
  }
  if (kind === 'audio') {
    return <audio src={src} controls className="w-56" />
  }
  // share / file — link out with a small card.
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors">
      <FileText className="h-4 w-4 text-muted-foreground" />
      {kind === 'share' ? 'Shared post' : 'Attachment'}
    </a>
  )
}

interface Props {
  messages: Message[]
  conversation: Conversation
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  const [showDraft, setShowDraft] = useState(false)

  const attachments = message.attachments ?? []

  return (
    <div className={cn('flex flex-col gap-1', isOutbound ? 'items-end' : 'items-start')}>
      {/* Media attachments (images, video, voice notes, shared posts). */}
      {attachments.length > 0 && (
        <div className={cn('flex max-w-[70%] flex-col gap-1.5', isOutbound ? 'items-end' : 'items-start')}>
          {attachments.map((a, i) => (
            <Attachment key={i} attachment={a} />
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

export function MessageThread({ messages }: Props) {
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
            <MessageBubble message={message} />
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
