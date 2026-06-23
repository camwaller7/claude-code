import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    try {
      const supabase = await createServerClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('[auth/callback] exchange error:', error)
        return NextResponse.redirect(new URL('/auth/login?error=auth', request.url))
      }
    } catch (e) {
      console.error('[auth/callback] unexpected error:', e)
      return NextResponse.redirect(new URL('/auth/login?error=auth', request.url))
    }
  }

  return NextResponse.redirect(new URL('/inbox', request.url))
}
