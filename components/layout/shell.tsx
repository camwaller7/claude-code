import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <span className="text-base font-semibold">Influencer PA</span>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">PA</AvatarFallback>
          </Avatar>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
