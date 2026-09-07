import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '@/lib/supabase/admin'
import { getLLMSettings, logTokenUsage } from '@/lib/llm/settings'
import { llmComplete } from '@/lib/llm/client'
import { checkAIBudget } from '@/lib/llm/budget'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { getUserTier } from '@/lib/billing/subscription'
import { tierConfig, HAIKU } from '@/lib/billing/tiers'
import { getDailyInteractionCount } from '@/lib/billing/limits'
import { getUserCredits, consumeCredits } from '@/lib/billing/credits'
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
  "category": "brand_deal"|"client"|"fan"|"personal"|"spam"|"uncategorized",
  "draftReply": "short 1-3 sentence reply",
  "priority": 0-10,
  "reasoning": "brief explanation"
}
Categories: brand_deal=sponsorship/partnership outreach; client=an existing paying course client; fan=general audience/fan message; personal=a message from someone the creator knows personally (friend, family, or a real-life acquaintance) rather than a fan or business contact; spam=junk/scam; uncategorized=none of the above.
Priority: 10=urgent brand deal/client issue, 5=normal brand outreach, 3=personal message, 2=fan message, 0=spam.`

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
    // The system prompt + tool schema are identical on every triage call, so
    // cache them: after the first call they're reused at ~10% of input price.
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [
      {
        name: 'triage_message',
        description: 'Categorize an influencer message and draft a reply',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: { type: 'string', enum: ['brand_deal', 'client', 'fan', 'personal', 'spam', 'uncategorized'] },
            draftReply: { type: 'string' },
            priority: { type: 'number' },
            reasoning: { type: 'string' },
          },
          required: ['category', 'draftReply', 'priority', 'reasoning'],
        },
        cache_control: { type: 'ephemeral' },
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

const UNCATEGORIZED: TriageResult = { category: 'uncategorized', draftReply: '', priority: 0, reasoning: '' }

export async function triageMessage(
  body: string,
  contactName: string,
  platform: string,
  userId?: string | null
): Promise<TriageResult> {
  // Respect the monthly AI spend cap. Triage runs on every inbound message, so
  // if the budget is spent we skip the LLM call and leave the message
  // uncategorized rather than failing ingest or blowing past the limit.
  const budget = await checkAIBudget()
  if (budget.over) {
    return { ...UNCATEGORIZED, reasoning: 'AI budget reached' }
  }

  // Multi-user: triage always runs on Haiku (cheapest) and counts toward the
  // user's Starter daily interaction cap. Over the cap, skip it.
  let provider = 'anthropic'
  let model = HAIKU
  if (multiUserEnabled() && userId) {
    const tier = await getUserTier(userId)
    const cfg = tierConfig(tier)
    if (cfg.dailyInteractionCap != null) {
      const used = await getDailyInteractionCount(userId)
      if (used >= cfg.dailyInteractionCap) {
        // Over the included allowance — spend a purchased interaction credit if
        // available, otherwise leave the message uncategorized.
        const credits = await getUserCredits(userId)
        if (credits.interaction_credits > 0) {
          await consumeCredits(userId, 1, 0).catch(() => {})
        } else {
          return { ...UNCATEGORIZED, reasoning: 'Daily AI limit reached' }
        }
      }
    }
  } else {
    const settings = await getLLMSettings()
    provider = settings.provider
    model = settings.model
  }

  const result = provider === 'anthropic'
    ? await triageWithAnthropic(model, body, contactName, platform)
    : await triageWithLLM(provider, model, body, contactName, platform)

  await logTokenUsage(provider, model, 'triage', result.inputTokens, result.outputTokens, userId).catch(console.error)

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
