import { adminSupabase } from '@/lib/supabase/admin'
import { zernioEnabled, listZernioAccounts } from '@/lib/platform/zernio'
import type { Platform } from '@/types'

const KNOWN_PLATFORMS: Platform[] = ['instagram', 'facebook', 'x', 'threads', 'tiktok', 'gmail', 'telegram']

// Normalize a provider's platform label to our internal Platform type.
// Zernio reports X as "twitter"; everything else already matches.
function normalize(p: string): Platform | null {
  const v = p === 'twitter' ? 'x' : p
  return (KNOWN_PLATFORMS as string[]).includes(v) ? (v as Platform) : null
}

// The set of platforms considered "linked" for filtering. In multi-user mode
// (userId provided) this is the user's own connected accounts from
// zernio_accounts. In the single-tenant pilot it's the live Zernio workspace
// accounts plus the app's platform_connections. Returned in display order.
export async function getLinkedPlatforms(userId?: string | null): Promise<Platform[]> {
  const linked = new Set<Platform>()

  if (userId) {
    const { data } = await adminSupabase
      .from('zernio_accounts')
      .select('platform')
      .eq('user_id', userId)
    for (const a of data ?? []) {
      const p = normalize(a.platform as string)
      if (p) linked.add(p)
    }
    return KNOWN_PLATFORMS.filter((p) => linked.has(p))
  }

  if (zernioEnabled()) {
    const res = await listZernioAccounts().catch(() => null)
    if (res?.ok && res.data) {
      const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []
      for (const a of accounts) {
        const p = normalize(a.platform)
        if (p) linked.add(p)
      }
    }
  }

  const { data: conns } = await adminSupabase
    .from('platform_connections')
    .select('platform')
  for (const c of conns ?? []) {
    const p = normalize(c.platform as string)
    if (p) linked.add(p)
  }

  return KNOWN_PLATFORMS.filter((p) => linked.has(p))
}
