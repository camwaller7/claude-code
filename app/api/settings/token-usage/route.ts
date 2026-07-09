import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: all } = await adminSupabase
    .from('token_usage')
    .select('provider, model, feature, input_tokens, output_tokens, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = all ?? []

  const sum = (items: typeof rows) => ({
    input: items.reduce((s, r) => s + r.input_tokens, 0),
    output: items.reduce((s, r) => s + r.output_tokens, 0),
    total: items.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0),
  })

  return NextResponse.json({
    today: sum(rows.filter(r => r.created_at >= startOfToday)),
    month: sum(rows.filter(r => r.created_at >= startOfMonth)),
    allTime: sum(rows),
    byFeature: {
      triage: sum(rows.filter(r => r.feature === 'triage')),
      draft_reply: sum(rows.filter(r => r.feature === 'draft_reply')),
    },
    recent: rows.slice(0, 20),
  })
}
