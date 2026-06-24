import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'

export async function GET() {
  const { data, error } = await adminSupabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const body = await request.json() as { llm_provider?: string; llm_model?: string }
  const { data, error } = await adminSupabase
    .from('settings')
    .update(body)
    .eq('id', 1)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
