import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

// Unauthenticated on purpose — this is meant for external uptime monitoring.
// Returns ONLY DB reachability; no business data and no activity-timing signal
// (the previous "last message N minutes ago" field leaked account activity to
// any anonymous caller).
export async function GET() {
  const checks: Record<string, boolean> = {}

  try {
    const { error } = await adminSupabase.from('settings').select('id').limit(1)
    checks.database = !error
  } catch {
    checks.database = false
  }

  const ok = checks.database
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 })
}
