'use client'

import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials = email ? email.slice(0, 2).toUpperCase() : 'PA'

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {}
    await fetch('/auth/signout', { method: 'POST' }).catch(() => {})
    window.location.href = '/auth/login'
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-label="Account menu"
        onClick={() => setOpen(o => !o)}
        className="rounded-full outline-none ring-violet-400 focus-visible:ring-2"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border bg-popover p-1 shadow-lg">
          <p className="truncate px-3 py-2 text-xs text-muted-foreground">{email ?? 'Signed in'}</p>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
