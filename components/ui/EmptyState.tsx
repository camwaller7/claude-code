import type { LucideIcon } from 'lucide-react'

// Friendly empty-state card: an icon in a soft circle, a heading, a short
// description, and an optional call-to-action. Used wherever a list has no
// items yet so new users get guidance instead of a bare "nothing here" line.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
