import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  } catch (e) {
    console.error('[signout]', e)
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  return NextResponse.redirect(`${appUrl}/auth/login`, { status: 302 })
}
