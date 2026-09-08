import { describe, it, expect, afterEach, vi } from 'vitest'
import { toAyrsharePlatform, fromAyrsharePlatform } from '@/lib/platform/ayrshare'

describe('Ayrshare platform mapping', () => {
  it('maps our slugs to Ayrshare names (x -> twitter)', () => {
    expect(toAyrsharePlatform('x')).toBe('twitter')
    expect(toAyrsharePlatform('instagram')).toBe('instagram')
    expect(toAyrsharePlatform('tiktok')).toBe('tiktok')
    expect(toAyrsharePlatform('threads')).toBe('threads')
  })

  it('maps Ayrshare names back to our slugs (twitter -> x)', () => {
    expect(fromAyrsharePlatform('twitter')).toBe('x')
    expect(fromAyrsharePlatform('facebook')).toBe('facebook')
  })

  it('is a round trip for supported platforms', () => {
    for (const p of ['instagram', 'facebook', 'x', 'threads', 'tiktok']) {
      expect(fromAyrsharePlatform(toAyrsharePlatform(p))).toBe(p)
    }
  })

  it('passes through unknown platforms unchanged', () => {
    expect(toAyrsharePlatform('linkedin')).toBe('linkedin')
    expect(fromAyrsharePlatform('linkedin')).toBe('linkedin')
  })
})

describe('conflictTarget (mode-aware upsert keys)', () => {
  const prev = process.env.MULTIUSER_ENABLED
  afterEach(() => {
    if (prev === undefined) delete process.env.MULTIUSER_ENABLED
    else process.env.MULTIUSER_ENABLED = prev
    // Reset the module cache so the flag is re-read.
    vi.resetModules?.()
  })

  it('uses global keys in single-tenant mode', async () => {
    process.env.MULTIUSER_ENABLED = 'false'
    vi.resetModules()
    const { conflictTarget } = await import('@/lib/db/conflictTargets')
    expect(conflictTarget.conversation()).toBe('platform,external_thread_id')
    expect(conflictTarget.message()).toBe('external_message_id')
    expect(conflictTarget.followerSnapshot()).toBe('platform,snapshot_date')
    expect(conflictTarget.contentMetric()).toBe('platform,external_post_id')
  })

  it('uses per-user composite keys in multi-user mode', async () => {
    process.env.MULTIUSER_ENABLED = 'true'
    vi.resetModules()
    const { conflictTarget } = await import('@/lib/db/conflictTargets')
    expect(conflictTarget.conversation()).toBe('user_id,platform,external_thread_id')
    expect(conflictTarget.message()).toBe('user_id,external_message_id')
    expect(conflictTarget.followerSnapshot()).toBe('user_id,platform,snapshot_date')
    expect(conflictTarget.contentMetric()).toBe('user_id,platform,external_post_id')
  })
})
