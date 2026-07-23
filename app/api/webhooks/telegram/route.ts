import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { triageMessage } from '@/lib/anthropic/triage'
import { getTelegramToken, telegramWebhookSecret } from '@/lib/platform/telegram'

interface TelegramUser {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: { id: number }
  date: number
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest) {
  // Verify the request against the per-bot secret we set on setWebhook,
  // recomputed from the stored bot token. Single-owner → one connection.
  const botToken = await getTelegramToken()
  if (!botToken) {
    // Telegram isn't connected — 200 so Telegram doesn't retry endlessly.
    return NextResponse.json({ ok: true })
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!safeEqual(header, telegramWebhookSecret(botToken))) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  try {
    const update = (await request.json()) as TelegramUpdate
    const msg = update.message

    // Only handle real inbound text messages from a human user.
    if (msg?.text && msg.from && !msg.from.is_bot) {
      const from = msg.from
      const name =
        [from.first_name, from.last_name].filter(Boolean).join(' ').trim() ||
        from.username ||
        String(from.id)
      const handle = from.username ? `@${from.username}` : String(from.id)
      const chatId = String(msg.chat.id)
      const sentAt = new Date(msg.date * 1000).toISOString()

      const { data: conv } = await adminSupabase
        .from('conversations')
        .upsert(
          {
            platform: 'telegram',
            external_thread_id: chatId,
            contact_name: name,
            contact_handle: handle,
            status: 'needs_reply',
            last_message_at: sentAt,
          },
          { onConflict: 'platform,external_thread_id' }
        )
        .select()
        .single()

      if (conv) {
        await adminSupabase.from('messages').insert({
          conversation_id: conv.id,
          direction: 'inbound',
          body: msg.text,
          sent_at: sentAt,
        })

        const triage = await triageMessage(msg.text, handle, 'telegram')
        await adminSupabase
          .from('conversations')
          .update({ category: triage.category, priority: triage.priority })
          .eq('id', conv.id)
      }
    }
  } catch (err) {
    console.error('Telegram webhook error:', err)
  }

  // Always 200 so Telegram considers the update delivered.
  return NextResponse.json({ ok: true })
}
