export const dynamic = 'force-dynamic'

import { Shell } from '@/components/layout/shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { Platform, PlatformConnection } from '@/types'
import Link from 'next/link'

interface PlatformConfig {
  label: string
  platform: Platform
  connectHref: string | null
  description: string
  manualNote?: string
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    label: 'Instagram',
    platform: 'instagram',
    connectHref: '/api/instagram/connect',
    description: 'Connect your Instagram Business or Creator account to sync DMs and publish content.',
  },
  {
    label: 'Facebook',
    platform: 'facebook',
    connectHref: '/api/meta/connect',
    description: 'Connect your Facebook Page to sync messages and publish content.',
  },
  {
    label: 'X (Twitter)',
    platform: 'x',
    connectHref: '/api/x/connect',
    description: 'Connect your X account to sync DMs and tweets.',
  },
  {
    label: 'Gmail',
    platform: 'gmail',
    connectHref: '/api/gmail/connect',
    description: 'Connect Gmail to manage email brand inquiries.',
  },
  {
    label: 'Threads',
    platform: 'threads',
    connectHref: '/api/threads/connect',
    description: 'Connect Threads to publish content.',
  },
  {
    label: 'TikTok',
    platform: 'tiktok',
    connectHref: null,
    description: 'TikTok integration is handled via a third-party scheduling provider.',
    manualNote: 'Manual setup required — configure your TikTok scheduling provider credentials separately.',
  },
]

export default async function OnboardingPage() {
  await requireAuth()
  const { data: connections } = await adminSupabase
    .from('platform_connections')
    .select('*')

  const connectionsByPlatform = new Map<Platform, PlatformConnection>()
  for (const conn of (connections ?? []) as PlatformConnection[]) {
    connectionsByPlatform.set(conn.platform, conn)
  }

  return (
    <Shell>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Platform Connections</h1>
          <p className="text-sm text-muted-foreground">Connect your social platforms to start syncing messages and scheduling posts.</p>
        </div>
        <div className="flex flex-col gap-4">
          {PLATFORM_CONFIGS.map((config) => {
            const connection = connectionsByPlatform.get(config.platform)
            const isConnected = Boolean(connection)

            return (
              <Card key={config.platform}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{config.label}</CardTitle>
                    <Badge variant={isConnected ? 'default' : 'outline'}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                  {isConnected && connection && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Account: <span className="font-medium">{connection.account_id}</span>
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {config.manualNote ? (
                    <p className="text-sm text-muted-foreground">{config.manualNote}</p>
                  ) : config.connectHref ? (
                    <Link href={config.connectHref}>
                      <Button variant="outline" size="sm">
                        {isConnected ? 'Reconnect' : 'Connect'}
                      </Button>
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
