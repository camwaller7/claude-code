import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ayrshareEnabled } from '@/lib/platform/ayrshare'
import { getStoredAyrshareProfile, refreshLinkedPlatforms } from '@/lib/platform/ayrshareProfile'

// Reports which platforms the current user has linked in Ayrshare, so the post
// portal can show connection status and validate post targets. Refreshes the
// cached list from Ayrshare on each call (cheap, and keeps it live after the
// user returns from the SSO linking page).
export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!ayrshareEnabled()) {
    return NextResponse.json({ enabled: false, connected: false, linkedPlatforms: [] })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getStoredAyrshareProfile(user.id)
  if (!profile) {
    return NextResponse.json({ enabled: true, connected: false, linkedPlatforms: [] })
  }

  const linkedPlatforms = await refreshLinkedPlatforms(user.id)
  return NextResponse.json({
    enabled: true,
    connected: linkedPlatforms.length > 0,
    linkedPlatforms,
  })
}
