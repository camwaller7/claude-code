import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { cookies } from 'next/headers'

export async function GET(_request: NextRequest) {
  // Generate PKCE code_verifier (43-128 chars, base64url)
  const codeVerifier = randomBytes(32).toString('base64url')

  // SHA-256 hash → base64url = code_challenge
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  cookieStore.set('x_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_API_KEY!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/x/callback`,
    scope: 'dm.read dm.write tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`
  return NextResponse.redirect(url)
}
