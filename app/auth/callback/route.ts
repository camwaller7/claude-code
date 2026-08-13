import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase/env'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin

  console.log('[auth/callback] params:', { code: !!code, tokenHash: !!tokenHash, type, appUrl })

  const cookieStore = await cookies()

  const supabase = _createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, sameSite: 'lax', secure: true })
          })
        },
      },
    }
  )

  // A magic link is a verification/recovery step, never a direct dashboard
  // login — it always routes through set/reset-password, so a working
  // session can only ever be reached by knowing the password (or by proving
  // email ownership and immediately choosing a new one).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'email' | 'magiclink' })
    if (error) {
      console.error('[auth/callback] verifyOtp error:', error.message)
      return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
    }
    return NextResponse.redirect(`${appUrl}/auth/set-password`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchange error:', error.message)
      return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
    }
    return NextResponse.redirect(`${appUrl}/auth/set-password`)
  }

  return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
}
