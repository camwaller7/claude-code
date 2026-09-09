import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

// Invite-only signup for the multi-user trial. A creator provides their email and
// the shared invite code (SIGNUP_INVITE_CODE); if the code matches we create the
// account and email them a set-up link. Public endpoint (the user has no session
// yet), so it's brute-force protected by IP and dormant unless multi-user is on
// AND a code is configured.

export async function POST(request: NextRequest) {
  // Signups only exist in the multi-user trial. In the single-tenant pilot this
  // route is closed, so it can ship well ahead of go-live with no effect.
  if (!multiUserEnabled()) {
    return NextResponse.json({ error: 'Signups are not open.' }, { status: 403 })
  }
  const inviteCode = process.env.SIGNUP_INVITE_CODE
  if (!inviteCode) {
    // No code configured ⇒ no self-signup. Fail closed.
    return NextResponse.json({ error: 'Signups are not open.' }, { status: 403 })
  }

  // Throttle by IP so the shared code can't be brute-forced.
  const limited = await checkRateLimit({ key: `signup:${clientIp(request)}`, limit: 10, windowSeconds: 3600 })
  if (limited) return limited

  let email = ''
  let code = ''
  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    code = typeof body.code === 'string' ? body.code.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (code !== inviteCode) {
    return NextResponse.json({ error: "That invite code isn't valid." }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const redirectTo = `${appUrl}/auth/callback`

  // Create the account and email a set-up link. If the email is already
  // registered, don't disclose that — return the same success so the endpoint
  // can't be used to probe which emails have accounts.
  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error && !/already|registered|exists/i.test(error.message)) {
    console.error('[signup] invite failed:', error.message)
    return NextResponse.json({ error: 'Could not send your invite — please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
