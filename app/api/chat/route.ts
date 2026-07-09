import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getContentAnalytics } from '@/lib/analytics/stats'
import { getLLMSettings, logTokenUsage } from '@/lib/llm/settings'
import { llmComplete } from '@/lib/llm/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VIBE_PROMPTS: Record<string, string> = {
  friendly: 'Be warm, encouraging and positive. Use emojis occasionally. Speak like a supportive friend.',
  professional: 'Be polished, concise and professional. Minimal emojis. Get straight to the point.',
  hype: "Be your creator's biggest fan! High energy, lots of emojis, celebrate every win, hype them up while still being genuinely useful.",
  chill: 'Be laid-back and casual. Keep it simple and low-key. No corporate speak, minimal fuss.',
}

function buildSystem(name: string, emoji: string, vibe: string): string {
  return `You are ${name} ${emoji} — the creator's personal AI assistant character inside their Influencer PA app. You have FULL read access to their business data: every conversation and message across Instagram, Facebook, X and Gmail, all brand deals, all clients, all posts (drafts, scheduled and published), and their dashboard stats. Use your tools liberally — always check real data before answering questions about their business.

Your personality: ${VIBE_PROMPTS[vibe] ?? VIBE_PROMPTS.friendly}

You can:
- Read and summarize any conversation or message in the inbox
- Search messages by content ("what did Priya say about the budget?")
- Report on deals, clients, posts and overall business stats
- Take actions: update deal status, create deals, draft replies
- PERSONALIZE CLIENT SERVICE: get_clients returns each client's full profile — age, job, location, goals, preferences, important dates, and an "ai_context" field the creator writes specifically to brief you. ALWAYS check a client's profile (especially ai_context and preferences) before drafting a reply to them or giving advice about them — tailor tone and content to who they actually are, not generically
- Analyze their content performance: follower growth, views, interactions, engagement rates, top/worst posts, what formats and posting times work best (get_content_analytics)
- COACH THEM ON GROWTH: when asked about growing their profile or what to post, pull the analytics first, identify what's actually working (formats, topics, timing, platforms) and what isn't, and give specific data-backed recommendations — not generic tips
- Give strategic advice on brand deals, rates, follow-ups, and finding new brand partnerships

When asked about anything in their data, USE A TOOL to look it up rather than guessing. Always stay in character as ${name}. You're helping a busy creator stay on top of their business without it feeling like work.`
}

const tools: Anthropic.Tool[] = [
  {
    name: 'list_conversations',
    description: 'List inbox conversations with contact, platform, category, status and priority. Use to get conversation IDs for reading messages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', enum: ['brand_deal', 'client', 'fan', 'spam', 'uncategorized'] },
        status: { type: 'string', enum: ['needs_reply', 'replied', 'archived'] },
        platform: { type: 'string', enum: ['instagram', 'facebook', 'x', 'gmail'] },
        limit: { type: 'number', description: 'Max results (default 25)' },
      },
    },
  },
  {
    name: 'read_conversation',
    description: 'Read the FULL message history of one conversation, including message text, direction (inbound/outbound), timestamps and any AI draft replies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        conversation_id: { type: 'string', description: 'The conversation ID from list_conversations' },
      },
      required: ['conversation_id'],
    },
  },
  {
    name: 'search_messages',
    description: 'Full-text search across ALL message bodies in the inbox. Returns matching messages with their conversation context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Text to search for in message bodies' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_deals',
    description: 'Get all brand deals with values, statuses, contacts and notes.',
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
        deal_id: { type: 'string' },
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
    description: 'Draft a reply for a conversation. Read the conversation first so the draft has real context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: { type: 'string' },
        conversation_context: { type: 'string', description: 'Summary of the thread and what the reply should achieve' },
      },
      required: ['contact_name', 'conversation_context'],
    },
  },
  {
    name: 'get_clients',
    description: 'Get all course/coaching clients with products, purchase dates, statuses and notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'churned', 'refunded'] },
      },
    },
  },
  {
    name: 'get_posts',
    description: 'Get all posts: caption, hashtags, target platforms, schedule time, publish status and media.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['draft', 'scheduled', 'publishing', 'published', 'failed'] },
      },
    },
  },
  {
    name: 'get_content_analytics',
    description: 'Full social analytics: current followers per platform, net follower change (7d/30d), 30-day follower trend, views and interactions last 7 days, top and worst performing posts, per-post metrics, breakdowns by media format and platform, and best posting hours. USE THIS whenever the creator asks about growth, performance, what content works, or wants content strategy advice.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_business_stats',
    description: 'Get overall business stats: total revenue, pipeline value, win rate, unread count, client counts, post counts.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'list_conversations': {
        let q = adminSupabase
          .from('conversations')
          .select('id, contact_name, contact_handle, category, status, priority, platform, last_message_at')
          .order('last_message_at', { ascending: false })
          .limit((input.limit as number) ?? 25)
        if (input.category) q = q.eq('category', input.category as string)
        if (input.status) q = q.eq('status', input.status as string)
        if (input.platform) q = q.eq('platform', input.platform as string)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data ?? [])
      }
      case 'read_conversation': {
        const [{ data: conv }, { data: msgs, error }] = await Promise.all([
          adminSupabase.from('conversations').select('*').eq('id', input.conversation_id as string).single(),
          adminSupabase
            .from('messages')
            .select('direction, body, ai_category, ai_draft_reply, sent_at')
            .eq('conversation_id', input.conversation_id as string)
            .order('sent_at', { ascending: true })
            .limit(100),
        ])
        if (error) return `Error: ${error.message}`
        if (!conv) return 'Conversation not found — use list_conversations to get valid IDs.'
        return JSON.stringify({ conversation: conv, messages: msgs ?? [] })
      }
      case 'search_messages': {
        const term = String(input.query ?? '').replace(/[%_]/g, '')
        if (!term) return 'Empty search query.'
        const { data, error } = await adminSupabase
          .from('messages')
          .select('body, direction, sent_at, conversation_id, conversations(contact_name, contact_handle, platform, category)')
          .ilike('body', `%${term}%`)
          .order('sent_at', { ascending: false })
          .limit(20)
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data ?? [])
      }
      case 'get_deals': {
        let q = adminSupabase.from('deals').select('*').order('created_at', { ascending: false })
        if (input.status) q = q.eq('status', input.status as string)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data ?? [])
      }
      case 'update_deal_status': {
        const { data, error } = await adminSupabase
          .from('deals')
          .update({ status: input.status })
          .eq('id', input.deal_id as string)
          .select()
          .single()
        if (error) return `Error: ${error.message}`
        return `Updated deal "${data.brand_name}" to status "${data.status}"`
      }
      case 'create_deal': {
        const { data, error } = await adminSupabase
          .from('deals')
          .insert({
            brand_name: input.brand_name,
            contact_name: input.contact_name ?? null,
            deal_value: input.deal_value ?? null,
            status: input.status,
            notes: input.notes ?? null,
            currency: 'USD',
          })
          .select()
          .single()
        if (error) return `Error: ${error.message}`
        return `Created deal for "${data.brand_name}" with status "${data.status}"`
      }
      case 'draft_reply': {
        const { provider, model } = await getLLMSettings()
        const { text, inputTokens, outputTokens } = await llmComplete({
          provider,
          model,
          system: 'You draft short, friendly replies for a content creator. Return ONLY the reply text, 2-4 sentences max.',
          prompt: `Draft a reply to ${input.contact_name}. Context: ${input.conversation_context}`,
          maxTokens: 300,
        })
        await logTokenUsage(provider, model, 'draft_reply', inputTokens, outputTokens).catch(() => {})
        return `Draft reply:\n\n"${text.trim()}"`
      }
      case 'get_clients': {
        let q = adminSupabase.from('clients').select('*').order('created_at', { ascending: false })
        if (input.status) q = q.eq('status', input.status as string)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data ?? [])
      }
      case 'get_posts': {
        let q = adminSupabase.from('posts').select('*').order('created_at', { ascending: false })
        if (input.status) q = q.eq('status', input.status as string)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        return JSON.stringify(data ?? [])
      }
      case 'get_content_analytics': {
        const analytics = await getContentAnalytics()
        return JSON.stringify(analytics)
      }
      case 'get_business_stats': {
        const [{ data: deals }, { count: convTotal }, { count: needsReply }, { data: clients }, { data: posts }] = await Promise.all([
          adminSupabase.from('deals').select('status, deal_value'),
          adminSupabase.from('conversations').select('*', { count: 'exact', head: true }),
          adminSupabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'needs_reply'),
          adminSupabase.from('clients').select('status'),
          adminSupabase.from('posts').select('status'),
        ])
        const d = deals ?? []
        const revenue = d.filter(x => x.status === 'paid').reduce((s, x) => s + (x.deal_value ?? 0), 0)
        const pipeline = d.filter(x => ['inquiry', 'negotiating', 'contracted', 'delivered'].includes(x.status)).reduce((s, x) => s + (x.deal_value ?? 0), 0)
        const won = d.filter(x => x.status === 'paid').length
        const closed = d.filter(x => ['paid', 'lost'].includes(x.status)).length
        return JSON.stringify({
          total_revenue_usd: revenue,
          pipeline_value_usd: pipeline,
          win_rate_pct: closed ? Math.round((won / closed) * 100) : null,
          total_conversations: convTotal ?? 0,
          needs_reply: needsReply ?? 0,
          active_clients: (clients ?? []).filter(c => c.status === 'active').length,
          total_clients: (clients ?? []).length,
          posts: {
            published: (posts ?? []).filter(p => p.status === 'published').length,
            scheduled: (posts ?? []).filter(p => p.status === 'scheduled').length,
            drafts: (posts ?? []).filter(p => p.status === 'draft').length,
          },
        })
      }
      default:
        return 'Unknown tool'
    }
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : String(e)}`
  }
}

/** Drop empty messages (they make the Anthropic API reject the request). */
function sanitizeMessages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.filter(m => {
    if (typeof m.content === 'string') return m.content.trim().length > 0
    return Array.isArray(m.content) && m.content.length > 0
  })
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  let messages: Anthropic.MessageParam[]
  try {
    const body = await request.json() as { messages?: Anthropic.MessageParam[] }
    messages = sanitizeMessages(body.messages ?? [])
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 })
  }

  const [{ data: settings }, llm] = await Promise.all([
    adminSupabase
      .from('settings')
      .select('assistant_name, assistant_emoji, assistant_vibe')
      .eq('id', 1)
      .single(),
    getLLMSettings(),
  ])
  const system = buildSystem(
    settings?.assistant_name ?? 'Nova',
    settings?.assistant_emoji ?? '✨',
    settings?.assistant_vibe ?? 'friendly'
  )

  const keyByProvider: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY,
    groq: process.env.GROQ_API_KEY,
  }
  if (!keyByProvider[llm.provider]) {
    return NextResponse.json(
      { error: `The selected AI provider (${llm.provider}) has no API key configured. Add it in Railway variables or pick a different model in Settings.` },
      { status: 500 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const push = (text: string) => controller.enqueue(encoder.encode(text))
      try {
        if (llm.provider === 'anthropic') {
          // Full agentic tool loop with token-level streaming
          let currentMessages = [...messages]
          let inputTokens = 0
          let outputTokens = 0

          for (let i = 0; i < 6; i++) {
            const anthropicStream = anthropic.messages.stream({
              model: llm.model,
              max_tokens: 1500,
              system,
              tools,
              messages: currentMessages,
            })

            anthropicStream.on('text', (delta) => push(delta))

            const res = await anthropicStream.finalMessage()
            inputTokens += res.usage.input_tokens
            outputTokens += res.usage.output_tokens

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
          await logTokenUsage('anthropic', llm.model, 'chat', inputTokens, outputTokens).catch(() => {})
        } else {
          // Other providers don't run our tool loop — give them a live data
          // snapshot as context instead, so answers still use real data.
          const [stats, analytics, convs] = await Promise.all([
            runTool('get_business_stats', {}),
            runTool('get_content_analytics', {}),
            runTool('list_conversations', { limit: 15 }),
          ])
          const contextBlock = `LIVE DATA SNAPSHOT (use this to answer):\nBUSINESS STATS: ${stats}\nCONTENT ANALYTICS: ${analytics}\nRECENT CONVERSATIONS: ${convs}`

          const history = messages
            .map(m => `${m.role === 'user' ? 'Creator' : 'Assistant'}: ${typeof m.content === 'string' ? m.content : ''}`)
            .join('\n')

          const { text, inputTokens, outputTokens } = await llmComplete({
            provider: llm.provider,
            model: llm.model,
            system: `${system}\n\n${contextBlock}`,
            prompt: history,
            maxTokens: 1500,
          })
          push(text)
          await logTokenUsage(llm.provider, llm.model, 'chat', inputTokens, outputTokens).catch(() => {})
        }
      } catch (e) {
        console.error('[chat] stream error:', e)
        const detail = e instanceof Error ? e.message : 'unknown error'
        push(`\n\nSorry, I hit a snag (${detail.slice(0, 140)}). Please try again.`)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
