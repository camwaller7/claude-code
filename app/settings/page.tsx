export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth/requireAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { LLMSettings } from '@/components/settings/LLMSettings'
import { AssistantSettings } from '@/components/settings/AssistantSettings'
import { LookSettings } from '@/components/settings/LookSettings'
import { TokenUsagePanel } from '@/components/settings/TokenUsagePanel'
import { AuditLogPanel } from '@/components/settings/AuditLogPanel'
import { AccountPanel } from '@/components/settings/AccountPanel'

export default async function SettingsPage() {
  await requireAuth()

  const { data: settings } = await adminSupabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your look, your assistant, your AI model and usage
        </p>
      </div>
      <AccountPanel />
      <LookSettings initialTheme={settings?.brand_theme ?? 'studio'} />
      <AssistantSettings
        initialName={settings?.assistant_name ?? 'Elle'}
        initialEmoji={settings?.assistant_emoji ?? '✨'}
        initialVibe={settings?.assistant_vibe ?? 'friendly'}
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
