import { adminSupabase } from '@/lib/supabase/admin'
import {
  ayrshareEnabled,
  createAyrshareProfile,
  getAyrshareUser,
  fromAyrsharePlatform,
} from '@/lib/platform/ayrshare'

export interface StoredAyrshareProfile {
  user_id: string
  profile_key: string
  ref_id: string | null
  title: string | null
  linked_platforms: string[]
}

// Read a user's stored Ayrshare profile row, or null if they don't have one.
export async function getStoredAyrshareProfile(
  userId: string
): Promise<StoredAyrshareProfile | null> {
  const { data } = await adminSupabase
    .from('ayrshare_profiles')
    .select('user_id, profile_key, ref_id, title, linked_platforms')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as StoredAyrshareProfile | null) ?? null
}

// The publishing key for a user, or null if they haven't been provisioned. Used
// by the publish path to act on the user's behalf.
export async function getAyrshareProfileKey(userId: string): Promise<string | null> {
  const row = await getStoredAyrshareProfile(userId)
  return row?.profile_key ?? null
}

// Ensure the user has an Ayrshare profile, creating one on first use. Idempotent:
// returns the existing row if present. Returns null when Ayrshare isn't
// configured or profile creation fails (caller surfaces the error).
export async function ensureAyrshareProfile(
  userId: string,
  title: string
): Promise<StoredAyrshareProfile | null> {
  if (!ayrshareEnabled()) return null

  const existing = await getStoredAyrshareProfile(userId)
  if (existing) return existing

  const res = await createAyrshareProfile(title)
  if (!res.ok || !res.data?.profileKey) {
    console.error('[ayrshare] profile creation failed:', res.error)
    return null
  }

  const row = {
    user_id: userId,
    profile_key: res.data.profileKey,
    ref_id: res.data.refId ?? null,
    title: res.data.title ?? title,
    linked_platforms: [] as string[],
    updated_at: new Date().toISOString(),
  }
  // Upsert guards against a race where two requests provision at once; the
  // unique user_id PK means the second write just refreshes the same row.
  const { data, error } = await adminSupabase
    .from('ayrshare_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('user_id, profile_key, ref_id, title, linked_platforms')
    .single()
  if (error) {
    console.error('[ayrshare] failed to store profile:', error.message)
    return null
  }
  return data as StoredAyrshareProfile
}

// Refresh (and cache) the platforms a user has linked in Ayrshare. Returns the
// internal platform slugs. Called after the user returns from the SSO linking
// page and before publishing.
export async function refreshLinkedPlatforms(userId: string): Promise<string[]> {
  const row = await getStoredAyrshareProfile(userId)
  if (!row) return []
  const res = await getAyrshareUser(row.profile_key)
  if (!res.ok || !res.data) return row.linked_platforms
  const linked = (res.data.activeSocialAccounts ?? []).map(fromAyrsharePlatform)
  await adminSupabase
    .from('ayrshare_profiles')
    .update({ linked_platforms: linked, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  return linked
}
