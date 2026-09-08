import { adminSupabase } from '@/lib/supabase/admin'
import { multiUserEnabled } from '@/lib/auth/currentUser'

// Assistant persona + app theme are per-user preferences. In multi-user mode
// they live in user_settings (one row per user); in the single-tenant pilot
// they stay on the global settings row (id=1). This module hides that split so
// callers just ask for "this user's persona/theme".

export interface PersonaTheme {
  assistant_name: string
  assistant_emoji: string
  assistant_vibe: string
  brand_theme: string
}

const DEFAULTS: PersonaTheme = {
  assistant_name: 'Nova',
  assistant_emoji: '✨',
  assistant_vibe: 'friendly',
  brand_theme: 'playground',
}

const FIELDS = 'assistant_name, assistant_emoji, assistant_vibe, brand_theme'

// Read the effective persona/theme for a user. Falls back to sensible defaults
// when no row exists yet (a new multi-user user who hasn't customised anything).
export async function getPersonaTheme(userId?: string | null): Promise<PersonaTheme> {
  if (multiUserEnabled() && userId) {
    const { data } = await adminSupabase
      .from('user_settings')
      .select(FIELDS)
      .eq('user_id', userId)
      .maybeSingle()
    return { ...DEFAULTS, ...(data ?? {}) }
  }
  // Single-tenant pilot: the global settings row.
  const { data } = await adminSupabase
    .from('settings')
    .select(FIELDS)
    .eq('id', 1)
    .maybeSingle()
  return { ...DEFAULTS, ...(data ?? {}) }
}

// Persist a persona/theme change for a user. Writes user_settings in multi-user
// mode (upserting the row), or the global settings row in the pilot. Only the
// provided fields are changed.
export async function savePersonaTheme(
  userId: string | null,
  patch: Partial<PersonaTheme>
): Promise<PersonaTheme> {
  const clean: Partial<PersonaTheme> = {}
  for (const k of ['assistant_name', 'assistant_emoji', 'assistant_vibe', 'brand_theme'] as const) {
    if (patch[k] != null) clean[k] = patch[k]
  }

  if (multiUserEnabled() && userId) {
    const { data } = await adminSupabase
      .from('user_settings')
      .upsert(
        { user_id: userId, ...clean, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select(FIELDS)
      .single()
    return { ...DEFAULTS, ...(data ?? {}) }
  }

  const { data } = await adminSupabase
    .from('settings')
    .update(clean)
    .eq('id', 1)
    .select(FIELDS)
    .single()
  return { ...DEFAULTS, ...(data ?? {}) }
}
