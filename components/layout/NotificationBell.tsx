'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Briefcase, Users, Send, MessageCircle, Clock, Music } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Reminder {
  id: string
  type: string
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  href: string | null
  due_at: string | null
}

// A stored event notification (e.g. a post going live) — normalised into the
// same shape as a reminder so both render in one list.
interface StoredNotification {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  read_at: string | null
  created_at: string
}

const ICONS: Record<string, React.ElementType> = {
  deal_due: Briefcase,
  client_date: Users,
  no_post_scheduled: Send,
  posting_gap: Send,
  best_time_approaching: Clock,
  needs_reply: MessageCircle,
  post_published: Music,
}

export function NotificationBell() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    function load() {
      fetch('/api/reminders')
        .then(r => r.json())
        .then(data => { if (!cancelled && Array.isArray(data.reminders)) setReminders(data.reminders) })
        .catch(() => {})
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => { if (!cancelled && Array.isArray(data.notifications)) setNotifications(data.notifications) })
        .catch(() => {})
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unreadCount = notifications.filter(n => !n.read_at).length
  const highCount = reminders.filter(r => r.priority === 'high').length
  const total = unreadCount + reminders.length

  // Opening the panel marks stored notifications read (they've been seen).
  function toggle() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      setNotifications(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
      fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className={cn(
            'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
            highCount > 0 || unreadCount > 0 ? 'bg-red-500' : 'bg-amber-500'
          )}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 max-h-[28rem] overflow-y-auto rounded-xl border bg-popover shadow-lg">
          <div className="border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
          ) : (
            <div className="flex flex-col p-1">
              {/* Stored events (e.g. a post going live) first — they're time-stamped. */}
              {notifications.map(n => {
                const Icon = ICONS[n.type] ?? Bell
                const body = (
                  <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    </div>
                  </div>
                )
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>{body}</Link>
                ) : (
                  <div key={n.id}>{body}</div>
                )
              })}
              {reminders.map(r => {
                const Icon = ICONS[r.type] ?? Bell
                const body = (
                  <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors">
                    <div className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      r.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                        : r.priority === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                    </div>
                  </div>
                )
                return r.href ? (
                  <Link key={r.id} href={r.href} onClick={() => setOpen(false)}>{body}</Link>
                ) : (
                  <div key={r.id}>{body}</div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
