import { adminSupabase } from '@/lib/supabase/admin'
import { getContentAnalytics } from '@/lib/analytics/stats'

export interface Reminder {
  id: string
  type: 'deal_due' | 'client_date' | 'no_post_scheduled' | 'posting_gap' | 'best_time_approaching' | 'needs_reply'
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  href: string | null
  due_at: string | null
}

const DAY_MS = 86_400_000

function parseDatesFromText(text: string | null): Date[] {
  if (!text) return []
  const found: Date[] = []
  // ISO / slash dates: 2026-07-20, 20/07/2026, 07-20-2026
  const dateRe = /\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g
  let m: RegExpExecArray | null
  while ((m = dateRe.exec(text))) {
    const raw = m[1] ?? m[2]
    const d = new Date(raw)
    if (!isNaN(d.getTime())) found.push(d)
  }
  return found
}

export async function getReminders(): Promise<Reminder[]> {
  const now = new Date()
  const reminders: Reminder[] = []

  const [{ data: deals }, { data: clients }, { data: posts }, analytics, { data: needsReplyConvs }] = await Promise.all([
    adminSupabase.from('deals').select('id, brand_name, status, payment_due_date, agreed_date, notes').not('status', 'in', '(paid,lost)'),
    adminSupabase.from('clients').select('id, name, important_dates, status').eq('status', 'active'),
    adminSupabase.from('posts').select('id, status, scheduled_at, published_at').order('scheduled_at', { ascending: false }).limit(50),
    getContentAnalytics().catch(() => null),
    adminSupabase.from('conversations').select('id, contact_name, category, priority').eq('status', 'needs_reply'),
  ])

  // ---- Deal due dates ----
  for (const d of deals ?? []) {
    if (d.payment_due_date) {
      const due = new Date(d.payment_due_date)
      const daysAway = Math.round((due.getTime() - now.getTime()) / DAY_MS)
      if (daysAway <= 7) {
        reminders.push({
          id: `deal-due-${d.id}`,
          type: 'deal_due',
          priority: daysAway < 0 ? 'high' : daysAway <= 2 ? 'high' : 'medium',
          title: daysAway < 0 ? `${d.brand_name} payment overdue` : `${d.brand_name} payment due ${daysAway === 0 ? 'today' : `in ${daysAway}d`}`,
          detail: `Deal status: ${d.status}`,
          href: '/deals',
          due_at: d.payment_due_date,
        })
      }
    }
    // Deadlines mentioned in free-text notes (e.g. "post must go live by 20/07/2026")
    for (const found of parseDatesFromText(d.notes)) {
      const daysAway = Math.round((found.getTime() - now.getTime()) / DAY_MS)
      if (daysAway >= 0 && daysAway <= 5) {
        reminders.push({
          id: `deal-note-${d.id}-${found.getTime()}`,
          type: 'deal_due',
          priority: daysAway <= 1 ? 'high' : 'medium',
          title: `${d.brand_name}: deadline ${daysAway === 0 ? 'today' : `in ${daysAway}d`}`,
          detail: 'Mentioned in deal notes',
          href: '/deals',
          due_at: found.toISOString(),
        })
      }
    }
  }

  // ---- Client important dates ----
  for (const c of clients ?? []) {
    for (const found of parseDatesFromText(c.important_dates)) {
      const daysAway = Math.round((found.getTime() - now.getTime()) / DAY_MS)
      if (daysAway >= 0 && daysAway <= 7) {
        reminders.push({
          id: `client-date-${c.id}-${found.getTime()}`,
          type: 'client_date',
          priority: daysAway <= 1 ? 'high' : 'medium',
          title: `${c.name}: important date ${daysAway === 0 ? 'today' : `in ${daysAway}d`}`,
          detail: 'From client profile',
          href: `/clients/${c.id}`,
          due_at: found.toISOString(),
        })
      }
    }
  }

  // ---- Posting cadence ----
  const upcomingScheduled = (posts ?? []).filter(p => p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at) > now)
  if (upcomingScheduled.length === 0) {
    reminders.push({
      id: 'no-post-scheduled',
      type: 'no_post_scheduled',
      priority: 'medium',
      title: "You don't have a post scheduled",
      detail: 'Queue something in the Post Portal to keep your cadence going',
      href: '/post-portal',
      due_at: null,
    })
  }

  const lastPublished = (posts ?? []).filter(p => p.status === 'published' && p.published_at).sort((a, b) => (b.published_at! > a.published_at! ? 1 : -1))[0]
  if (lastPublished?.published_at) {
    const daysSince = Math.floor((now.getTime() - new Date(lastPublished.published_at).getTime()) / DAY_MS)
    if (daysSince >= 2) {
      reminders.push({
        id: 'posting-gap',
        type: 'posting_gap',
        priority: daysSince >= 4 ? 'high' : 'medium',
        title: `It's been ${daysSince} days since your last post`,
        detail: 'Consistent posting keeps your engagement rate up',
        href: '/post-portal',
        due_at: null,
      })
    }
  }

  // ---- Best posting time approaching ----
  const bestHour = analytics?.breakdown.best_posting_hours[0]?.hour
  if (bestHour != null) {
    const hoursUntil = (bestHour - now.getUTCHours() + 24) % 24
    if (hoursUntil > 0 && hoursUntil <= 2 && upcomingScheduled.length === 0) {
      reminders.push({
        id: 'best-time-approaching',
        type: 'best_time_approaching',
        priority: 'medium',
        title: `Your best posting time is in ${hoursUntil}h`,
        detail: `${bestHour}:00 UTC historically gets your highest views — got something ready?`,
        href: '/post-portal',
        due_at: null,
      })
    }
  }

  // ---- Needs-reply, weighted toward brand deals & clients ----
  for (const c of needsReplyConvs ?? []) {
    const isPriority = c.category === 'brand_deal' || c.category === 'client'
    reminders.push({
      id: `needs-reply-${c.id}`,
      type: 'needs_reply',
      priority: isPriority ? 'high' : c.priority > 5 ? 'medium' : 'low',
      title: `${c.contact_name} is waiting on a reply`,
      detail: c.category === 'brand_deal' ? 'Brand deal' : c.category === 'client' ? 'Client' : 'Message',
      href: '/inbox',
      due_at: null,
    })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return reminders.sort((a, b) => order[a.priority] - order[b.priority])
}
