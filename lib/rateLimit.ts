import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

// Two rate limiters live here:
//   - isRateLimited: a synchronous in-memory limiter, fine for best-effort
//     throttling within a single instance (used by the auth-audit endpoint).
//   - checkRateLimit: a Postgres-backed fixed-window limiter that holds across
//     serverless instances, for the cost-sensitive AI endpoints.

// ─── In-memory limiter ────────────────────────────────────────────────────────
// State doesn't survive a restart and isn't shared across instances. Acceptable
// for cheap, best-effort throttles; use checkRateLimit where correctness matters.
const hits = new Map<string, number[]>()

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  timestamps.push(now)
  hits.set(key, timestamps)

  // Bound memory growth from an unbounded set of keys (e.g. many distinct IPs).
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k)
    }
  }

  return timestamps.length > limit
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown'
}

// ─── DB-backed limiter ────────────────────────────────────────────────────────
// Fixed-window limiter backed by the rate_limits table (migration 034), so it
// holds across serverless instances. Returns a 429 response to return as-is when
// over the limit, or null when allowed.

export interface RateLimitOptions {
  // Stable bucket key, e.g. `chat:${userId}`. Callers namespace by feature.
  key: string
  // Max requests per window.
  limit: number
  // Window length in seconds.
  windowSeconds: number
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<NextResponse | null> {
  try {
    const { data, error } = await adminSupabase.rpc('rate_limit_hit', {
      p_key: opts.key,
      p_limit: opts.limit,
      p_window_seconds: opts.windowSeconds,
    })
    if (error) {
      // Fail open on infra errors — a limiter outage shouldn't take down the app.
      console.error('[rateLimit] rate_limit_hit failed:', error.message)
      return null
    }
    if (data === false) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(opts.windowSeconds) } }
      )
    }
    return null
  } catch (e) {
    console.error('[rateLimit] unexpected error:', e)
    return null
  }
}
