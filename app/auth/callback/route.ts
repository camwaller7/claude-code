import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin

  console.log('[auth/callback] params:', { code: !!code, tokenHash: !!tokenHash, type, appUrl })

  const cookieStore = await cookies()

  const supabase = _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'email' | 'magiclink' })
    if (error) {
      console.error('[auth/callback] verifyOtp error:', error.message)
      return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
    }
    return NextResponse.redirect(`${appUrl}/inbox`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchange error:', error.message)
      return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
    }
    return NextResponse.redirect(`${appUrl}/inbox`)
  }

  return NextResponse.redirect(`${appUrl}/auth/login?error=auth`)
}
