import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ayrshareEnabled, generateAyrshareLinkUrl } from '@/lib/platform/ayrshare'
import { ensureAyrshareProfile } from '@/lib/platform/ayrshareProfile'

// Provisions the current user's Ayrshare profile (first call) and returns a
// hosted SSO URL where they link/unlink their own social accounts. The post
// portal opens this URL so trial users can connect the platforms they'll post
// to — no Meta App Review or per-user OAuth on our side.
export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!ayrshareEnabled()) {
    return NextResponse.json(
      { error: 'Publishing is not configured yet. Set AYRSHARE_API_KEY.' },
      { status: 503 }
    )
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await ensureAyrshareProfile(user.id, user.email ?? user.id)
  if (!profile) {
    return NextResponse.json(
      { error: 'Could not create your publishing profile — try again shortly.' },
      { status: 502 }
    )
  }

  const linkRes = await generateAyrshareLinkUrl(profile.profile_key)
  if (!linkRes.ok || !linkRes.data?.url) {
    return NextResponse.json(
      { error: linkRes.error ?? 'Could not generate a connection link.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ url: linkRes.data.url })
}
