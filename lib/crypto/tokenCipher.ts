import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

// Encrypts platform OAuth tokens before they're stored in platform_connections,
// so a leaked SUPABASE_SERVICE_ROLE_KEY alone (which bypasses RLS) doesn't hand
// over live, usable tokens for every connected account — the decryption key
// lives only in this app's own env (Railway), a separate system entirely.
//
// TOKEN_ENCRYPTION_KEY must be a 32-byte key, base64-encoded. Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Versioned with a "v1:" prefix so decryptToken() can tell an already-encrypted
// value apart from a legacy plaintext token stored before this was added —
// legacy values are returned as-is rather than failing to decrypt.
const PREFIX = 'v1:'

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)')
  }
  return key
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptToken(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  if (!value.startsWith(PREFIX)) return value // legacy plaintext, not yet re-encrypted

  const raw = Buffer.from(value.slice(PREFIX.length), 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const ciphertext = raw.subarray(28)

  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
