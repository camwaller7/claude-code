import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase/env'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = supabaseUrl()
  const key = supabaseAnonKey()
  if (!url || !key) return response

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // Refreshes the session if the access token has expired and writes the
    // new tokens to cookies so server components see a valid session.
    await supabase.auth.getUser()
  } catch {
    // Never block a request because of an auth refresh failure
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)',
  ],
}
