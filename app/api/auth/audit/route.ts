import { NextRequest, NextResponse } from 'next/server'
import { auditLog } from '@/lib/audit/log'

// Deliberately unauthenticated — a failed/successful sign-in attempt has no
// session yet to prove identity with. Scope is tightly limited: a fixed
// action allowlist and a bounded email string, write-only, nothing is ever
// read back. Worst case from abuse is log noise, not a data exposure.
const ALLOWED_ACTIONS = new Set(['sign_in', 'sign_in_failed'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { action?: string; email?: string } | null
  if (!body || !ALLOWED_ACTIONS.has(body.action ?? '')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.slice(0, 200) : null
  await auditLog(body.action as 'sign_in' | 'sign_in_failed', undefined, email)
  return NextResponse.json({ ok: true })
}
