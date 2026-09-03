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

// The set of platforms considered "linked" for filtering. Instagram/Facebook
// (and any other Zernio-managed inbox) come from the live Zernio account list;
// other platforms (Gmail, X, Telegram, …) come from the app's own
// platform_connections table. The union is returned in a stable display order.
export async function getLinkedPlatforms(): Promise<Platform[]> {
  const linked = new Set<Platform>()

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
