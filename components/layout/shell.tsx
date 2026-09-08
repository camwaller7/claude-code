'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Sidebar } from './sidebar'
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react'
import { AIChat } from '@/components/chat/AIChat'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {/* Backdrop for the mobile drawer; desktop never shows it. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger opens the drawer on mobile only. */}
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Collapse toggle is desktop only. */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors md:block"
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <Image src="/corvelle-icon.png" alt="Corvelle" width={24} height={24} className="rounded-md" />
              <span className="text-base font-semibold">Corvelle</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
      <AIChat />
    </div>
  )
}
