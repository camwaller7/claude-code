'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(c => !c)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <span className="text-base font-semibold">Influencer PA</span>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-violet-100 text-violet-700">CA</AvatarFallback>
          </Avatar>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
