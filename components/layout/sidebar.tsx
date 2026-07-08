'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, Briefcase, Users, BarChart2, Send, Settings, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/deals', label: 'Deals', icon: Briefcase },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/post-portal', label: 'Post Portal', icon: Send },
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/conversations?status=needs_reply')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUnread(data.length) })
      .catch(() => {})
  }, [pathname])

  return (
    <aside className={cn(
      'flex h-screen flex-col border-r bg-background transition-all duration-200 shrink-0',
      collapsed ? 'w-14' : 'w-56'
    )}>
      {!collapsed && (
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-sm font-semibold text-muted-foreground">Navigation</span>
        </div>
      )}
      {collapsed && <div className="h-14 border-b" />}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-2',
              pathname.startsWith(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1">{label}</span>}
            {href === '/inbox' && unread > 0 && (
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white',
                collapsed && 'absolute translate-x-2 -translate-y-2 h-4 min-w-4'
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
          title={collapsed ? 'Connections' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-2',
            pathname === '/onboarding'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && 'Connections'}
        </Link>
      </div>
    </aside>
  )
}
