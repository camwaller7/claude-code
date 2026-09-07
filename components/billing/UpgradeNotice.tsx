import Link from 'next/link'
import { Sparkles } from 'lucide-react'

// Shown in place of a gated feature for tiers that don't include it.
export function UpgradeNotice({ feature, tier = 'Growth' }: { feature: string; tier?: string }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{feature} is a {tier} feature</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upgrade your plan to unlock {feature.toLowerCase()}.
        </p>
      </div>
      <Link
        href="/billing"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        See plans
      </Link>
    </div>
  )
}
