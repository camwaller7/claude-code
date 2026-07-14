import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

// Unauthenticated on purpose — this is meant for external uptime monitoring
// (or a quick manual check) and returns no business data, only whether the
// DB is reachable and background sync has run recently.
export async function GET() {
  const checks: Record<string, boolean> = {}

  try {
    const { error } = await adminSupabase.from('settings').select('id').limit(1)
    checks.database = !error
  } catch {
    checks.database = false
  }

  let lastSyncMinutesAgo: number | null = null
  try {
    const { data } = await adminSupabase
      .from('messages')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.created_at) {
      lastSyncMinutesAgo = Math.round((Date.now() - new Date(data.created_at).getTime()) / 60000)
    }
  } catch {
    // non-fatal — just means we can't report freshness
  }

  const ok = checks.database
  return NextResponse.json(
    { ok, checks, lastMessageReceivedMinutesAgo: lastSyncMinutesAgo },
    { status: ok ? 200 : 503 }
  )
}
