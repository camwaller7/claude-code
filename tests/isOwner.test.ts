import { describe, it, expect, afterEach } from 'vitest'
import { isOwnerEmail } from '@/lib/auth/isOwner'

const original = process.env.OWNER_EMAIL
afterEach(() => { process.env.OWNER_EMAIL = original })

describe('isOwnerEmail', () => {
  it('matches the configured owner (case/whitespace-insensitive)', () => {
    process.env.OWNER_EMAIL = 'creator@example.com'
    expect(isOwnerEmail('creator@example.com')).toBe(true)
    expect(isOwnerEmail('  CREATOR@Example.com ')).toBe(true)
  })

  it('rejects a non-owner', () => {
    process.env.OWNER_EMAIL = 'creator@example.com'
    expect(isOwnerEmail('attacker@evil.com')).toBe(false)
    expect(isOwnerEmail(null)).toBe(false)
    expect(isOwnerEmail(undefined)).toBe(false)
  })

  it('supports a comma-separated allowlist (e.g. review test account)', () => {
    process.env.OWNER_EMAIL = 'creator@example.com, reviewer@meta.com'
    expect(isOwnerEmail('reviewer@meta.com')).toBe(true)
    expect(isOwnerEmail('creator@example.com')).toBe(true)
    expect(isOwnerEmail('someone@else.com')).toBe(false)
  })

  // C4 fixed: fails CLOSED when OWNER_EMAIL is unset (deny, don't grant all).
  it('fails CLOSED when OWNER_EMAIL is unset', () => {
    delete process.env.OWNER_EMAIL
    expect(isOwnerEmail('anyone@example.com')).toBe(false)
  })
})
