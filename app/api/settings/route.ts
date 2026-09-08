import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { auditLog } from '@/lib/audit/log'
import { getCurrentUserId, currentUserIsOwner } from '@/lib/auth/currentUser'
import { getPersonaTheme, savePersonaTheme } from '@/lib/settings/userSettings'

// Returns the current user's effective settings: their own persona/theme merged
// with the platform-controlled LLM provider/model (global settings row).
export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const userId = await getCurrentUserId()
  const [persona, globalRow] = await Promise.all([
    getPersonaTheme(userId),
    adminSupabase.from('settings').select('llm_provider, llm_model').eq('id', 1).maybeSingle(),
  ])

  return NextResponse.json({
    ...persona,
    llm_provider: globalRow.data?.llm_provider ?? 'anthropic',
    llm_model: globalRow.data?.llm_model ?? 'claude-sonnet-4-6',
  })
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const body = (await request.json()) as {
    llm_provider?: string
    llm_model?: string
    assistant_name?: string
    assistant_emoji?: string
    assistant_vibe?: string
    brand_theme?: string
  }

  const userId = await getCurrentUserId()

  // Persona + theme are per-user preferences.
  const persona = await savePersonaTheme(userId, body)

  // LLM provider/model are platform-controlled (cost): only the owner may change
  // them, and they live on the shared global row. Non-owner attempts are ignored
  // rather than erroring so a normal settings save still succeeds.
  let llm = { llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-6' }
  const wantsLlmChange = body.llm_provider != null || body.llm_model != null
  if (wantsLlmChange && (await currentUserIsOwner())) {
    const llmPatch: Record<string, string> = {}
    if (body.llm_provider != null) llmPatch.llm_provider = body.llm_provider
    if (body.llm_model != null) llmPatch.llm_model = body.llm_model
    const { data } = await adminSupabase
      .from('settings')
      .update(llmPatch)
      .eq('id', 1)
      .select('llm_provider, llm_model')
      .single()
    if (data) llm = data
  } else {
    const { data } = await adminSupabase
      .from('settings')
      .select('llm_provider, llm_model')
      .eq('id', 1)
      .maybeSingle()
    if (data) llm = data
  }

  await auditLog('settings_changed', { fields: Object.keys(body) })
  return NextResponse.json({ ...persona, ...llm })
}
