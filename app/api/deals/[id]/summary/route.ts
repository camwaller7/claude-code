import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { scopedUserId, multiUserEnabled } from '@/lib/auth/currentUser'
import { getLLMSettings, logTokenUsage } from '@/lib/llm/settings'
import { llmComplete } from '@/lib/llm/client'
import { checkAIBudget } from '@/lib/llm/budget'
import { resolveModelForUser } from '@/lib/billing/modelRouting'
import { consumeCredits } from '@/lib/billing/credits'
import { OPUS, OPUS_INPUT_PER_1K, OPUS_OUTPUT_PER_1K } from '@/lib/billing/tiers'

// Generate (and cache) an AI preview of a brand deal from its fields and linked
// conversation. Charged against the user's AI usage (tier model routing, spend
// cap, and top-up credits), same as the chat assistant.
const SYSTEM =
  'You summarise a brand deal for a busy creator. In 3-5 short sentences cover: who the brand is, what they want, the money involved, where the deal currently stands, and the single most useful next step. Be concrete and skip filler.'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { id } = await params
  const userId = await scopedUserId()

  // Load the deal (scoped to the user in multi-user mode).
  let dealQ = adminSupabase.from('deals').select('*').eq('id', id)
  if (userId) dealQ = dealQ.eq('user_id', userId)
  const { data: deal } = await dealQ.maybeSingle()
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Pull the linked conversation for context, if any.
  let conversationText = '(no linked conversation)'
  if (deal.conversation_id) {
    const { data: msgs } = await adminSupabase
      .from('messages')
      .select('direction, body')
      .eq('conversation_id', deal.conversation_id)
      .order('sent_at', { ascending: true })
      .limit(50)
    if (msgs?.length) {
      conversationText = msgs.map(m => `${m.direction === 'inbound' ? 'Them' : 'You'}: ${m.body}`).join('\n')
    }
  }

  // Spend cap — per user in multi-user mode.
  const budget = await checkAIBudget(userId)
  if (budget.over) {
    return NextResponse.json({ error: "This month's AI usage limit has been reached." }, { status: 200 })
  }

  // Model selection: tier routing in multi-user, global settings otherwise.
  let provider = 'anthropic'
  let model: string
  let useInteractionCredit = false
  let useOpusCredit = false
  if (multiUserEnabled() && userId) {
    const decision = await resolveModelForUser(userId)
    if (decision.blocked === 'daily_limit') {
      return NextResponse.json({ error: "You've reached today's AI limit. Buy more on the Billing page or upgrade your plan." }, { status: 200 })
    }
    model = decision.model
    useInteractionCredit = !!decision.useInteractionCredit
    useOpusCredit = !!decision.useOpusCredit
  } else {
    const settings = await getLLMSettings()
    provider = settings.provider
    model = settings.model
  }

  const prompt = [
    `Brand: ${deal.brand_name}`,
    deal.contact_name ? `Contact: ${deal.contact_name}` : '',
    deal.deal_value != null ? `Value: ${deal.currency ?? ''} ${deal.deal_value}` : '',
    `Status: ${deal.status}`,
    deal.notes ? `Creator's notes: ${deal.notes}` : '',
    '',
    'Conversation:',
    conversationText,
  ].filter(Boolean).join('\n')

  let text: string
  let inputTokens = 0
  let outputTokens = 0
  try {
    const res = await llmComplete({ provider: provider as 'anthropic' | 'openai' | 'google' | 'groq', model, system: SYSTEM, prompt, maxTokens: 400 })
    text = res.text.trim()
    inputTokens = res.inputTokens
    outputTokens = res.outputTokens
  } catch (err) {
    console.error('[deal summary] generation failed:', err)
    return NextResponse.json({ error: 'Could not generate a summary. Please try again.' }, { status: 200 })
  }

  await logTokenUsage(provider, model, 'deal_summary', inputTokens, outputTokens, userId).catch(e => console.error('[deal-summary] usage log failed:', e))

  // Draw down top-up credits when the call ran beyond the plan's allowance.
  if (userId) {
    const opusCents = useOpusCredit && model === OPUS
      ? Math.round(((inputTokens / 1000) * OPUS_INPUT_PER_1K + (outputTokens / 1000) * OPUS_OUTPUT_PER_1K) * 100)
      : 0
    if (useInteractionCredit || opusCents > 0) {
      await consumeCredits(userId, useInteractionCredit ? 1 : 0, opusCents).catch(e => console.error('[deal-summary] credit consume failed:', e))
    }
  }

  let saveQ = adminSupabase
    .from('deals')
    .update({ ai_summary: text, ai_summary_at: new Date().toISOString() })
    .eq('id', id)
  if (userId) saveQ = saveQ.eq('user_id', userId)
  await saveQ

  return NextResponse.json({ summary: text })
}
