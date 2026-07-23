import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { encryptToken } from '@/lib/crypto/tokenCipher'
import { auditLog } from '@/lib/audit/log'
import { TELEGRAM_API, telegramWebhookSecret } from '@/lib/platform/telegram'

// Unlike the OAuth platforms, Telegram is connected by pasting a bot token
// created via @BotFather. We validate it, register our webhook with Telegram
// (secured by a per-bot secret), and store the token.
export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { botToken } = (await request.json().catch(() => ({}))) as { botToken?: string }
  const token = botToken?.trim()
  if (!token) {
    return NextResponse.json(
      { error: 'A bot token is required. Create a bot with @BotFather in Telegram (send /newbot) and paste the token it gives you.' },
      { status: 400 }
    )
  }

  // Validate the token and read the bot identity.
  const meRes = await fetch(`${TELEGRAM_API}/bot${token}/getMe`)
  const me = (await meRes.json().catch(() => ({}))) as {
    ok?: boolean
    result?: { id: number; username?: string; first_name?: string }
    description?: string
  }
  if (!meRes.ok || !me.ok || !me.result) {
    return NextResponse.json(
      { error: `Telegram rejected that token: ${me.description ?? 'invalid bot token'}` },
      { status: 400 }
    )
  }

  const botId = String(me.result.id)

  // Point Telegram's webhook at our receiver, secured with the per-bot secret.
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telegram`
  const setRes = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: telegramWebhookSecret(token),
      allowed_updates: ['message'],
    }),
  })
  const setData = (await setRes.json().catch(() => ({}))) as { ok?: boolean; description?: string }
  if (!setRes.ok || !setData.ok) {
    return NextResponse.json(
      { error: `Could not register the Telegram webhook: ${setData.description ?? setRes.status}. Check that NEXT_PUBLIC_APP_URL is a public HTTPS URL.` },
      { status: 400 }
    )
  }

  // Single-owner app: keep exactly one Telegram connection, so a reconnect with
  // a different bot replaces the old one rather than leaving a stale row.
  await adminSupabase.from('platform_connections').delete().eq('platform', 'telegram')
  await adminSupabase.from('platform_connections').insert({
    platform: 'telegram',
    account_id: botId,
    access_token: encryptToken(token),
    refresh_token: null,
    expires_at: null,
    connected_at: new Date().toISOString(),
  })

  await auditLog('platform_connected', { platform: 'telegram', bot: me.result.username ?? botId })

  return NextResponse.json({ ok: true, bot: me.result.username ?? botId })
}
