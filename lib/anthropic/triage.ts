import { anthropic } from './client'
import type { MessageCategory } from '@/types'

interface TriageResult {
  category: MessageCategory
  draftReply: string
  priority: number
  reasoning: string
}

export async function triageMessage(
  body: string,
  contactName: string,
  platform: string
): Promise<TriageResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an AI assistant helping an influencer/content creator manage their inbox. Analyze the following message and respond with a JSON object.

Platform: ${platform}
Sender: ${contactName}
Message: ${body}

Respond with ONLY a valid JSON object in this exact format:
{
  "category": "brand_deal" | "client" | "fan" | "spam" | "uncategorized",
  "draftReply": "a short, friendly suggested reply in the creator's voice",
  "priority": 0-10,
  "reasoning": "one sentence explaining the categorization"
}

Category definitions:
- brand_deal: outreach from a brand, PR agency, or partnership/sponsorship inquiry
- client: someone who has purchased or is asking about a course, product, or paid service from the creator
- fan: general fan engagement, compliments, questions from followers
- spam: unsolicited promotions, scams, or irrelevant mass messages
- uncategorized: cannot determine clearly

Priority: 10 = urgent brand deal with deadline, 7-9 = brand deal or paying client, 4-6 = engaged fan, 1-3 = general fan, 0 = spam`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as TriageResult
    return {
      category: parsed.category ?? 'uncategorized',
      draftReply: parsed.draftReply ?? '',
      priority: Math.min(10, Math.max(0, Number(parsed.priority) || 0)),
      reasoning: parsed.reasoning ?? '',
    }
  } catch {
    return {
      category: 'uncategorized',
      draftReply: '',
      priority: 0,
      reasoning: 'Failed to parse AI response',
    }
  }
}
