// In-memory sliding-window rate limiter. Correct for a single-instance
// deployment (Railway's default here) — state doesn't survive a restart and
// isn't shared across instances if this ever scales horizontally. That's an
// acceptable tradeoff for a single-creator pilot; revisit with a shared store
// (e.g. Upstash Redis) if the app ever runs multiple instances.
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
  return forwarded?.split(',')[0]?.trim() ?? 'unknown'
}
