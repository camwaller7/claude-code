import { Shell } from '@/components/layout/shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const platforms = [
  { name: 'Instagram / Facebook (Meta)', key: 'meta', description: 'Connect your Meta account for Instagram, Facebook, and Threads.' },
  { name: 'X (Twitter)', key: 'x', description: 'Connect your X account to sync DMs and mentions.' },
  { name: 'Gmail', key: 'gmail', description: 'Connect Gmail to manage email brand inquiries.' },
  { name: 'TikTok', key: 'tiktok', description: 'Connect TikTok via scheduling provider.' },
]

export default function OnboardingPage() {
  return (
    <Shell>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Platform Connections</h1>
          <p className="text-sm text-muted-foreground">Connect your social platforms to start syncing messages.</p>
        </div>
        <div className="flex flex-col gap-4">
          {platforms.map((p) => (
            <Card key={p.key}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline">Disconnected</Badge>
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" disabled>
                  Connect (coming soon)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Shell>
  )
}
