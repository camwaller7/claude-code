import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '@/lib/supabase/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are an AI personal assistant for a content creator/influencer. You have access to their app data: inbox messages, brand deals, clients, and scheduled posts. You help them manage their creator business.

You can:
- Answer questions about their data (deals, messages, clients, posts)
- Take actions: update deal status, draft replies, create deals, update client status
- Give strategic advice on brand deals, content, rates, follow-ups
- Research advice on finding brand deals, negotiation tactics, creator best practices

When the user asks you to take an action, use the appropriate tool. When they ask a question, answer it directly and helpfully using the context data provided.

Be friendly, concise, and speak like a knowledgeable friend — not a corporate assistant. Use emojis occasionally to keep it light. You're helping a busy creator stay on top of their business without it feeling like work.`

const tools: Anthropic.Tool[] = [
  {
    name: 'get_inbox_summary',
    description: 'Get a summary of inbox conversations, optionally filtered by category or status',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', enum: ['brand_deal', 'client', 'fan', 'spam', 'uncategorized'], description: 'Filter by category' },
        status: { type: 'string', enum: ['needs_reply', 'replied', 'archived'], description: 'Filter by status' },
        limit: { type: 'number', description: 'Max results to return' },
      },
    },
  },
  {
    name: 'get_deals',
    description: 'Get brand deals, optionally filtered by status',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost'] },
      },
    },
  },
  {
    name: 'update_deal_status',
    description: 'Update the status of a brand deal',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'string', description: 'The deal ID' },
        status: { type: 'string', enum: ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost'] },
      },
      required: ['deal_id', 'status'],
    },
  },
  {
    name: 'create_deal',
    description: 'Create a new brand deal record',
    input_schema: {
      type: 'object' as const,
      properties: {
        brand_name: { type: 'string' },
        contact_name: { type: 'string' },
        deal_value: { type: 'number' },
        status: { type: 'string', enum: ['inquiry', 'negotiating', 'contracted', 'delivered', 'paid', 'lost'] },
        notes: { type: 'string' },
      },
      required: ['brand_name', 'status'],
    },
  },
  {
    name: 'draft_reply',
    description: 'Draft a reply to a conversation',
    input_schema: {
      type: 'object' as const,
      properties: {
        conversation_id: { type: 'string' },
        contact_name: { type: 'string' },
        context: { type: 'string', description: 'What the reply should say or achieve' },
      },
      required: ['contact_name', 'context'],
    },
  },
  {
    name: 'get_clients',
    description: 'Get course/coaching clients',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'churned', 'refunded'] },
      },
    },
  },
  {
    name: 'get_posts',
    description: 'Get scheduled or published posts',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['draft', 'scheduled', 'published', 'failed'] },
      },
    },
  },
]

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_inbox_summary': {
      let q = adminSupabase.from('conversations').select('id, contact_name, contact_handle, category, status, platform, last_message_at').order('last_message_at', { ascending: false }).limit((input.limit as number) ?? 20)
      if (input.category) q = q.eq('category', input.category as string)
      if (input.status) q = q.eq('status', input.status as string)
      const { data } = await q
      return JSON.stringify(data ?? [])
    }
    case 'get_deals': {
      let q = adminSupabase.from('deals').select('*').order('created_at', { ascending: false })
      if (input.status) q = q.eq('status', input.status as string)
      const { data } = await q
      return JSON.stringify(data ?? [])
    }
    case 'update_deal_status': {
      const { data, error } = await adminSupabase.from('deals').update({ status: input.status }).eq('id', input.deal_id as string).select().single()
      if (error) return `Error: ${error.message}`
      return `Updated deal "${data.brand_name}" to status "${data.status}"`
    }
    case 'create_deal': {
      const { data, error } = await adminSupabase.from('deals').insert({
        brand_name: input.brand_name,
        contact_name: input.contact_name ?? null,
        deal_value: input.deal_value ?? null,
        status: input.status,
        notes: input.notes ?? null,
        currency: 'USD',
      }).select().single()
      if (error) return `Error: ${error.message}`
      return `Created deal for "${data.brand_name}" with status "${data.status}"`
    }
    case 'draft_reply': {
      const reply = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Draft a short, friendly reply for a content creator to send to ${input.contact_name}. Goal: ${input.context}. Keep it natural and warm, 2-4 sentences max.`,
        }],
      })
      const text = reply.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
      return `Draft reply:\n\n"${text}"`
    }
    case 'get_clients': {
      let q = adminSupabase.from('clients').select('*').order('created_at', { ascending: false })
      if (input.status) q = q.eq('status', input.status as string)
      const { data } = await q
      return JSON.stringify(data ?? [])
    }
    case 'get_posts': {
      let q = adminSupabase.from('posts').select('*').order('created_at', { ascending: false })
      if (input.status) q = q.eq('status', input.status as string)
      const { data } = await q
      return JSON.stringify(data ?? [])
    }
    default:
      return 'Unknown tool'
  }
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json() as { messages: Anthropic.MessageParam[] }

  try {
    let currentMessages = [...messages]

    // Agentic loop — up to 5 tool call rounds
    for (let i = 0; i < 5; i++) {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages: currentMessages,
      })

      if (res.stop_reason === 'end_turn') {
        const text = res.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
        return NextResponse.json({ reply: text })
      }

      if (res.stop_reason === 'tool_use') {
        const toolUses = res.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUses.map(async tu => ({
            type: 'tool_result' as const,
            tool_use_id: tu.id,
            content: await runTool(tu.name, tu.input as Record<string, unknown>),
          }))
        )

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: res.content },
          { role: 'user' as const, content: toolResults },
        ]
        continue
      }

      break
    }

    return NextResponse.json({ reply: 'Sorry, I ran into an issue. Please try again.' })
  } catch (e) {
    console.error('[chat]', e)
    return NextResponse.json({ reply: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
