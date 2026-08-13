import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('meta_oauth_state', state, {
    httpOnly: true,
    // OAuth redirects back as a top-level GET, so lax is required for the
    // cookie to be sent. Mark secure in production (the app is served over
    // HTTPS) while keeping local http dev working.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    // The consent step can take several minutes (Page picker, permission
    // review, occasionally a re-login/2FA). A short 10-minute window meant a
    // slow approval failed with "Invalid state"; 30 minutes is comfortable.
    maxAge: 1800,
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`,
    response_type: 'code',
    state,
  })

  // Facebook Login for Business apps require a dashboard "configuration" and
  // the OAuth request must carry its config_id — the configuration defines
  // which permissions and assets (Pages) are requested. Sending classic
  // `scope` params to a business-login dialog with no config makes Facebook
  // silently return access_denied after the user clicks through. When a
  // config id is set we use it; otherwise fall back to classic scope-based
  // Facebook Login so this keeps working for non-business-login apps.
  const configId = process.env.META_LOGIN_CONFIG_ID
  if (configId) {
    params.set('config_id', configId)
  } else {
    params.set('scope', 'pages_show_list,pages_messaging,pages_manage_posts')
  }

  const url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  return NextResponse.redirect(url)
}
