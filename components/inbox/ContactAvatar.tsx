'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: 'IG', facebook: 'FB', x: 'X', threads: 'TH',
    tiktok: 'TK', gmail: 'GM', telegram: 'TG',
  }
  return map[platform] ?? platform.slice(0, 2).toUpperCase()
}

// The contact's profile photo when Zernio gave us one, with a graceful fallback
// to the platform badge (also used when the photo URL has expired / fails to
// load). A small platform chip overlays the corner so you still see the source.
export function ContactAvatar({
  avatar,
  platform,
  name,
  size = 40,
  className,
}: {
  avatar: string | null | undefined
  platform: string
  name?: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImg = avatar && !failed
  const px = `${size}px`

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted', className)}
      style={{ width: px, height: px }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar as string}
          alt={name ?? 'Contact'}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">{platformLabel(platform)}</span>
      )}
      {/* Corner platform chip — only when a photo is shown, so the source stays clear. */}
      {showImg && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background px-1 text-[8px] font-bold leading-tight text-muted-foreground shadow-sm">
          {platformLabel(platform)}
        </span>
      )}
    </span>
  )
}
