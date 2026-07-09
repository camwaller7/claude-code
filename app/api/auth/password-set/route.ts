import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/audit/log'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { isReset?: boolean }
  await auditLog(body.isReset ? 'password_reset' : 'password_set', undefined, data.user.email)

  return NextResponse.json({ ok: true })
}
