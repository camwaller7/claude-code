import { adminSupabase } from '@/lib/supabase/admin'
import type { LLMProvider } from '@/types'

export async function getLLMSettings(): Promise<{ provider: LLMProvider; model: string }> {
  const { data } = await adminSupabase
    .from('settings')
    .select('llm_provider, llm_model')
    .eq('id', 1)
    .single()
  return {
    provider: (data?.llm_provider ?? 'anthropic') as LLMProvider,
    model: data?.llm_model ?? 'claude-sonnet-4-6',
  }
}

export async function logTokenUsage(
  provider: string,
  model: string,
  feature: string,
  inputTokens: number,
  outputTokens: number
) {
  await adminSupabase.from('token_usage').insert({
    provider,
    model,
    feature,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  })
}
