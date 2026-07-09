export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth/requireAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { LLMSettings } from '@/components/settings/LLMSettings'
import { AssistantSettings } from '@/components/settings/AssistantSettings'
import { LookSettings } from '@/components/settings/LookSettings'
import { TokenUsagePanel } from '@/components/settings/TokenUsagePanel'

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
        <p className="text-sm text-muted-foreground mt-1">Configure your AI model and view usage</p>
      </div>
      <LLMSettings
        initialProvider={settings?.llm_provider ?? 'anthropic'}
        initialModel={settings?.llm_model ?? 'claude-sonnet-4-6'}
      />
      <TokenUsagePanel />
    </div>
  )
}
