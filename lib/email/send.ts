import { adminSupabase } from '@/lib/supabase/admin'
import { multiUserEnabled } from '@/lib/auth/currentUser'

// Minimal transactional-email sender. Uses Resend's HTTP API when configured;
// otherwise it is a safe no-op so the app runs fine without email set up (the
// in-app notification is always stored regardless). Every failure is swallowed
// and logged — a notification must never fail a publish because email is down.
//
// Trial setup: set RESEND_API_KEY and EMAIL_FROM (a verified sender, e.g.
// "Corvelle <notifications@yourdomain.com>") in the environment.

interface SendEmailArgs {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<{ ok: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to)
    return { ok: false, skipped: true }
  }
  const from = process.env.EMAIL_FROM ?? 'Corvelle <notifications@corvelle.app>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] send failed:', res.status, await res.text().catch(() => ''))
      return { ok: false }
    }
    return { ok: true }
  } catch (err) {
    console.error('[email] send error:', err)
    return { ok: false }
  }
}

// Resolve a user's email for delivery. Multi-user: from Supabase auth. Pilot:
// the single app owner's email (app_owner table). Returns null when unknown.
export async function getUserEmail(userId?: string | null): Promise<string | null> {
  if (multiUserEnabled() && userId) {
    try {
      const { data } = await adminSupabase.auth.admin.getUserById(userId)
      return data.user?.email ?? null
    } catch (err) {
      console.error('[email] getUserById failed:', err)
      return null
    }
  }
  // Single-tenant pilot: the app owner.
  const { data } = await adminSupabase.from('app_owner').select('email').limit(1).maybeSingle()
  return (data?.email as string | undefined) ?? null
}
