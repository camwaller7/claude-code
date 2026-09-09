import { adminSupabase } from '@/lib/supabase/admin'
import { multiUserEnabled } from '@/lib/auth/currentUser'
import { sendEmail, getUserEmail } from '@/lib/email/send'

// One place to raise a notification. It respects the user's delivery channel:
//   in_app → store a bell row · email → send an email · both → do both · off → nothing
// The in-app row is the durable record; email is best-effort on top. Nothing
// here throws — a failed notification must never break the action that raised it.

export type NotifyChannel = 'in_app' | 'email' | 'both' | 'off'

const VALID: NotifyChannel[] = ['in_app', 'email', 'both', 'off']

// The effective delivery channel for a user. Multi-user reads user_settings;
// the pilot reads the global settings row. Defaults to 'both'.
export async function getNotifyChannel(userId?: string | null): Promise<NotifyChannel> {
  let value: string | undefined
  if (multiUserEnabled() && userId) {
    const { data } = await adminSupabase
      .from('user_settings')
      .select('notify_channel')
      .eq('user_id', userId)
      .maybeSingle()
    value = data?.notify_channel as string | undefined
  } else {
    const { data } = await adminSupabase
      .from('settings')
      .select('notify_channel')
      .eq('id', 1)
      .maybeSingle()
    value = data?.notify_channel as string | undefined
  }
  return VALID.includes(value as NotifyChannel) ? (value as NotifyChannel) : 'both'
}

export async function saveNotifyChannel(userId: string | null, channel: NotifyChannel): Promise<NotifyChannel> {
  const next: NotifyChannel = VALID.includes(channel) ? channel : 'both'
  if (multiUserEnabled() && userId) {
    await adminSupabase
      .from('user_settings')
      .upsert({ user_id: userId, notify_channel: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  } else {
    await adminSupabase.from('settings').update({ notify_channel: next }).eq('id', 1)
  }
  return next
}

interface NotifyArgs {
  userId?: string | null
  type: string
  title: string
  body?: string
  href?: string
  meta?: Record<string, unknown>
  // Plain-text lines for the email body; falls back to `body` when omitted.
  emailLines?: string[]
}

function emailHtml(title: string, lines: string[], href?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://corvelle.app'
  const link = href ? `${appUrl}${href}` : appUrl
  const paras = lines.map((l) => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">${l}</p>`).join('')
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${title}</h1>
    ${paras}
    <a href="${link}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open Corvelle</a>
    <p style="margin-top:24px;color:#94a3b8;font-size:12px">You can change how you're notified in Settings → Notifications.</p>
  </div>`
}

export async function createNotification(args: NotifyArgs): Promise<void> {
  const { userId, type, title, body, href, meta, emailLines } = args
  try {
    const channel = await getNotifyChannel(userId)
    if (channel === 'off') return

    if (channel === 'in_app' || channel === 'both') {
      await adminSupabase.from('notifications').insert({
        ...(userId ? { user_id: userId } : {}),
        type,
        title,
        body: body ?? null,
        href: href ?? null,
        meta: meta ?? null,
      })
    }

    if (channel === 'email' || channel === 'both') {
      const to = await getUserEmail(userId)
      if (to) {
        const lines = emailLines ?? (body ? [body] : [])
        await sendEmail({ to, subject: title, html: emailHtml(title, lines, href) })
      }
    }
  } catch (err) {
    console.error('[notify] createNotification failed:', err)
  }
}
