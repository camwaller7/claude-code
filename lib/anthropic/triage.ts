import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '@/lib/supabase/admin'
import { getLLMSettings, logTokenUsage } from '@/lib/llm/settings'
import { llmComplete } from '@/lib/llm/client'
import type { MessageCategory } from '@/types'

interface TriageResult {
  category: MessageCategory
  draftReply: string
  priority: number
  reasoning: string
}

const SYSTEM = `You are an AI assistant helping an influencer manage their messages.
Categorize the message and draft a reply. Respond ONLY with valid JSON:
{
  "category": "brand_deal"|"client"|"fan"|"spam"|"uncategorized",
  "draftReply": "short 1-3 sentence reply",
  "priority": 0-10,
  "reasoning": "brief explanation"
}
Priority: 10=urgent brand deal/client issue, 5=normal brand outreach, 2=fan message, 0=spam.`

async function triageWithAnthropic(
  model: string,
  body: string,
  contactName: string,
  platform: string
): Promise<TriageResult & { inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model,
    max_tokens: 512,
    tools: [
      {
        name: 'triage_message',
        description: 'Categorize an influencer message and draft a reply',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: { type: 'string', enum: ['brand_deal', 'client', 'fan', 'spam', 'uncategorized'] },
            draftReply: { type: 'string' },
            priority: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['category', 'draftReply', 'priority', 'reasoning'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'triage_message' },
    messages: [{ role: 'user', content: `Platform: ${platform}\nFrom: ${contactName}\nMessage: ${body}` }],
  })
  const toolBlock = res.content.find(b => b.type === 'tool_use') as { type: 'tool_use'; input: TriageResult } | undefined
  const result = toolBlock?.input ?? { category: 'uncategorized' as MessageCategory, draftReply: '', priority: 0, reasoning: '' }
  return { ...result, priority: Math.max(0, Math.min(10, Number(result.priority))), inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
}

async function triageWithLLM(
  provider: string,
  model: string,
  body: string,
  contactName: string,
  platform: string
): Promise<TriageResult & { inputTokens: number; outputTokens: number }> {
  const { text, inputTokens, outputTokens } = await llmComplete({
    provider: provider as 'openai' | 'google' | 'groq',
    model,
    system: SYSTEM,
    prompt: `Platform: ${platform}\nFrom: ${contactName}\nMessage: ${body}`,
    maxTokens: 512,
  })
  let result: TriageResult = { category: 'uncategorized', draftReply: '', priority: 0, reasoning: '' }
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    result = JSON.parse(cleaned)
    result.priority = Math.max(0, Math.min(10, Number(result.priority)))
  } catch {
    console.error('[triage] Failed to parse LLM JSON:', text)
  }
  return { ...result, inputTokens, outputTokens }
}

export async function triageMessage(
  body: string,
  contactName: string,
  platform: string
): Promise<TriageResult> {
  const { provider, model } = await getLLMSettings()

  const result = provider === 'anthropic'
    ? await triageWithAnthropic(model, body, contactName, platform)
    : await triageWithLLM(provider, model, body, contactName, platform)

  await logTokenUsage(provider, model, 'triage', result.inputTokens, result.outputTokens).catch(console.error)

  return {
    category: result.category,
    draftReply: result.draftReply,
    priority: result.priority,
    reasoning: result.reasoning,
  }
}

export async function triageAndSave(conversationId: string, messageBody: string, contactName: string, platform: string) {
  const result = await triageMessage(messageBody, contactName, platform)

  await adminSupabase
    .from('conversations')
    .update({ category: result.category, priority: result.priority })
    .eq('id', conversationId)

  await adminSupabase
    .from('messages')
    .update({ ai_category: result.category, ai_draft_reply: result.draftReply })
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)

  return result
}
