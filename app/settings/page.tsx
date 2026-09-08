export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth/requireAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { LLMSettings } from '@/components/settings/LLMSettings'
import { AssistantSettings } from '@/components/settings/AssistantSettings'
import { LookSettings } from '@/components/settings/LookSettings'
import { TokenUsagePanel } from '@/components/settings/TokenUsagePanel'
import { AuditLogPanel } from '@/components/settings/AuditLogPanel'
import { AccountPanel } from '@/components/settings/AccountPanel'
import { ConnectAccounts } from '@/components/settings/ConnectAccounts'
import { multiUserEnabled, scopedUserId } from '@/lib/auth/currentUser'
import { getPersonaTheme } from '@/lib/settings/userSettings'

export default async function SettingsPage() {
  await requireAuth()

  // In multi-user mode, show each creator their own connected social accounts.
  const uid = await scopedUserId()

  // Persona + theme are per-user; the LLM provider/model stay global.
  const [persona, { data: settings }] = await Promise.all([
    getPersonaTheme(uid),
    adminSupabase.from('settings').select('llm_provider, llm_model').eq('id', 1).maybeSingle(),
  ])
  const { data: connectedAccounts } = uid
    ? await adminSupabase.from('zernio_accounts').select('platform, username').eq('user_id', uid)
    : { data: null }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your look, your assistant, your AI model and usage
        </p>
      </div>
      <AccountPanel />
      {multiUserEnabled() && <ConnectAccounts connected={connectedAccounts ?? []} />}
      <LookSettings initialTheme={persona.brand_theme} />
      <AssistantSettings
        initialName={persona.assistant_name}
        initialEmoji={persona.assistant_emoji}
        initialVibe={persona.assistant_vibe}
      />
      <LLMSettings
        initialProvider={settings?.llm_provider ?? 'anthropic'}
        initialModel={settings?.llm_model ?? 'claude-sonnet-4-6'}
      />
      <TokenUsagePanel />
      <AuditLogPanel />
    </div>
  )
}
