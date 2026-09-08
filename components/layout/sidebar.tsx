'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, Briefcase, Users, BarChart2, Send, Settings, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { postPortalEnabled } from '@/lib/flags'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/deals', label: 'Deals', icon: Briefcase },
  { href: '/clients', label: 'Clients', icon: Users },
  // Post portal is hidden unless the master flag is on (see lib/flags.ts).
  ...(postPortalEnabled() ? [{ href: '/post-portal', label: 'Post Portal', icon: Send }] : []),
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar({
  collapsed,
  mobileOpen,
  onNavigate,
}: {
  collapsed?: boolean
  mobileOpen?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/conversations?status=needs_reply')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUnread(data.length) })
      .catch(() => {})
  }, [pathname])

  return (
    <aside
      className={cn(
        // On desktop (md+) the sidebar is part of the flex row and collapses to
        // an icon rail. On mobile it becomes a fixed off-canvas drawer that
        // slides in over the content when `mobileOpen` is set.
        'flex h-screen flex-col border-r transition-all duration-200',
        'fixed inset-y-0 left-0 z-50 w-56 md:static md:z-auto md:shrink-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-14' : 'md:w-56'
      )}
      style={{ background: 'var(--sidebar-bg)' }}
    >
      <div className="flex h-14 items-center border-b px-4">
        {/* Brand wordmark; collapses to just the mark on desktop, full in the drawer. */}
        <span className={cn('font-display text-lg font-semibold tracking-tight brand-text', collapsed && 'md:hidden')}>
          Corvelle
        </span>
        <span className={cn('hidden font-display text-lg font-semibold brand-text', collapsed && 'md:inline')}>C</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              collapsed && 'md:justify-center md:px-2',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {/* Active-state accent bar on the leading edge. */}
            {active && (
              <span
                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                style={{ background: 'var(--brand-accent)' }}
                aria-hidden="true"
              />
            )}
            <Icon className={cn('h-4 w-4 shrink-0', active && 'text-[var(--brand-accent)]')} />
            <span className={cn('flex-1', collapsed && 'md:hidden')}>{label}</span>
            {href === '/inbox' && unread > 0 && (
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white',
                collapsed && 'md:absolute md:translate-x-2 md:-translate-y-2 md:h-4 md:min-w-4'
              )}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
          )
        })}
      </nav>
      <div className="border-t p-2">
        <Link
          href="/onboarding"
          onClick={onNavigate}
          title={collapsed ? 'Connections' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            collapsed && 'md:justify-center md:px-2',
            pathname === '/onboarding'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && 'md:hidden')}>Connections</span>
        </Link>
      </div>
    </aside>
  )
}
