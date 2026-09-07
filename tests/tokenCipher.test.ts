import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

// A valid 32-byte base64 key must be present before importing the module.
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

describe('tokenCipher', () => {
  it('round-trips a token (encrypt then decrypt)', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/crypto/tokenCipher')
    const secret = 'ig_access_token_ABC123.-_'
    const enc = encryptToken(secret)
    expect(enc.startsWith('v1:')).toBe(true)
    expect(enc).not.toContain(secret) // ciphertext must not leak plaintext
    expect(decryptToken(enc)).toBe(secret)
  })

  it('returns legacy plaintext (no v1: prefix) unchanged', async () => {
    const { decryptToken } = await import('@/lib/crypto/tokenCipher')
    expect(decryptToken('legacy_plain_token')).toBe('legacy_plain_token')
  })

  it('handles null/undefined', async () => {
    const { decryptToken } = await import('@/lib/crypto/tokenCipher')
    expect(decryptToken(null)).toBeNull()
    expect(decryptToken(undefined)).toBeNull()
  })

  it('fails to decrypt a tampered ciphertext (auth tag)', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/crypto/tokenCipher')
    const enc = encryptToken('secret')
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A')
    expect(() => decryptToken(tampered)).toThrow()
  })
})
