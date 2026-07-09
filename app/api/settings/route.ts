import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { auditLog } from '@/lib/audit/log'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const { data, error } = await adminSupabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const body = await request.json() as { llm_provider?: string; llm_model?: string; assistant_name?: string; assistant_emoji?: string; assistant_vibe?: string; brand_theme?: string }
  const { data, error } = await adminSupabase
    .from('settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await auditLog('settings_changed', { fields: Object.keys(body) })
  return NextResponse.json(data)
}
