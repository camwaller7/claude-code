import { createHash } from 'crypto'
import { adminSupabase } from '@/lib/supabase/admin'
import { decryptToken } from '@/lib/crypto/tokenCipher'

export const TELEGRAM_API = 'https://api.telegram.org'

// Telegram's setWebhook accepts a secret_token that it then echoes back on every
// update in the X-Telegram-Bot-Api-Secret-Token header. We derive it
// deterministically from the stored bot token (+ INTERNAL_API_SECRET when set)
// so it needs no separate storage — the webhook recomputes it from the token in
// the DB and rejects any request whose header doesn't match. Hex output is a
// valid secret_token (1-256 chars of A-Za-z0-9_-).
export function telegramWebhookSecret(botToken: string): string {
  return createHash('sha256')
    .update(`${botToken}:${process.env.INTERNAL_API_SECRET ?? ''}`)
    .digest('hex')
}

// Single-owner app → one Telegram connection. Returns the decrypted bot token
// or null if Telegram isn't connected.
export async function getTelegramToken(): Promise<string | null> {
  const { data } = await adminSupabase
    .from('platform_connections')
    .select('access_token')
    .eq('platform', 'telegram')
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return decryptToken(data.access_token)
}
