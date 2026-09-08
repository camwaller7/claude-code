'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, Briefcase, Users, BarChart2, Send, Settings, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/deals', label: 'Deals', icon: Briefcase },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/post-portal', label: 'Post Portal', icon: Send },
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
        {/* Label hides when collapsed on desktop; always shown in the mobile drawer. */}
        <span className={cn('text-sm font-semibold text-muted-foreground', collapsed && 'md:hidden')}>
          Navigation
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              collapsed && 'md:justify-center md:px-2',
              pathname.startsWith(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
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
        ))}
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
