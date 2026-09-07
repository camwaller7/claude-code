import { getUserTier } from '@/lib/billing/subscription'
import { tierConfig, type TierConfig } from '@/lib/billing/tiers'
import { multiUserEnabled, scopedUserId } from '@/lib/auth/currentUser'

// Whether the current user's tier includes a given feature. In the single-tenant
// pilot (multi-user off) everything is available.
export async function currentUserHasFeature(feature: keyof TierConfig['features']): Promise<boolean> {
  if (!multiUserEnabled()) return true
  const uid = await scopedUserId()
  if (!uid) return true
  const cfg = tierConfig(await getUserTier(uid))
  return cfg.features[feature]
}
