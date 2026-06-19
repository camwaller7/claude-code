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
    tools: [
      {
        name: 'triage_message',
        description: 'Categorize an influencer message and draft a reply',
        input_schema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['brand_deal', 'client', 'fan', 'spam', 'uncategorized'],
              description: 'The message category',
            },
            draftReply: {
              type: 'string',
              description: 'A short, natural suggested reply (1-3 sentences)',
            },
            priority: {
              type: 'number',
              description: 'Priority 0-10, where 10 is most urgent',
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of the categorization',
            },
          },
          required: ['category', 'draftReply', 'priority', 'reasoning'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'triage_message' },
    messages: [
      {
        role: 'user',
        content: `You are an AI assistant helping an influencer manage their messages.

Platform: ${platform}
From: ${contactName}
Message: ${body}

Categorize this message and draft a reply. Categories:
- brand_deal: brands or agencies pitching sponsorships, collaborations, or paid promotions
- client: existing clients asking about products/services they purchased
- fan: genuine fan messages, compliments, questions from followers
- spam: unsolicited bulk messages, scams, irrelevant pitches
- uncategorized: unclear intent

Priority 0-10: 10 = urgent brand deal or client issue, 5 = normal brand outreach, 2 = fan message, 0 = spam.`,
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return {
      category: 'uncategorized',
      draftReply: '',
      priority: 0,
      reasoning: 'Failed to triage',
    }
  }

  const input = toolUse.input as TriageResult
  return {
    category: input.category as MessageCategory,
    draftReply: input.draftReply,
    priority: Math.max(0, Math.min(10, Number(input.priority))),
    reasoning: input.reasoning,
  }
}
