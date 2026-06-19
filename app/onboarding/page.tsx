import { Shell } from '@/components/layout/shell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const platforms = [
  {
    name: 'Instagram & Facebook',
    description: 'Connect via Meta Business API. Add yourself as a test user in your Meta Developer app — no App Review needed for one creator.',
    key: 'meta',
  },
  {
    name: 'X (Twitter)',
    description: 'Connect via X API v2. Pay-per-use pricing — at pilot volume expect a few dollars/month.',
    key: 'x',
  },
  {
    name: 'Gmail',
    description: 'Connect via Gmail API with OAuth. Your emails will appear in the unified inbox and be triaged by AI.',
    key: 'gmail',
  },
  {
    name: 'TikTok',
    description: 'Connected via a third-party scheduling provider (no direct TikTok API — they require a compliance audit). Post scheduling only; no DM inbox.',
    key: 'tiktok',
  },
  {
    name: 'Threads',
    description: 'Post scheduling via Meta Graph API. Note: Threads DM inbox is not available — Meta has not released a DM API for Threads yet.',
    key: 'threads',
  },
]

export default function OnboardingPage() {
  return (
    <Shell>
      <div className="flex flex-col h-full">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h1 className="text-lg font-semibold">Platform Connections</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Connect your accounts to start pulling in messages and scheduling posts.</p>
        </div>
        <div className="flex flex-col gap-4 p-6 max-w-2xl">
          {platforms.map((p) => (
            <Card key={p.key}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 max-w-md">{p.description}</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Connect
                </Button>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-zinc-400 mt-2">OAuth flows for each platform will be wired up in the next build phase.</p>
        </div>
      </div>
    </Shell>
  )
}
