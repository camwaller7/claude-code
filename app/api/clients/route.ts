import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabase } from '@/lib/supabase/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createRouteHandlerSupabase()
  const body = await request.json() as {
    name: string
    handle: string
    product_purchased: string
    purchase_date?: string
    status?: string
    notes?: string
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: body.name,
      handle: body.handle,
      product_purchased: body.product_purchased,
      purchase_date: body.purchase_date ?? null,
      status: body.status ?? 'active',
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
