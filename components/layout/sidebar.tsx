'use client'

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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold text-muted-foreground">Navigation</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-2">
        <Link
          href="/onboarding"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/onboarding'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Connections
        </Link>
      </div>
    </aside>
  )
}
