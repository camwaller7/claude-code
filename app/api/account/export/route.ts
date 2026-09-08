import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'

// GDPR-style data export (audit M6): returns everything we hold for the current
// user as a single JSON download. Scoped strictly to their user_id. Secrets
// (OAuth tokens, the Ayrshare profile key) are deliberately excluded.
const USER_TABLES = [
  'conversations',
  'messages',
  'deals',
  'clients',
  'posts',
  'follower_snapshots',
  'content_metrics',
  'token_usage',
  'user_settings',
  'subscriptions',
  'user_credits',
  'zernio_accounts',
]

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bundle: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
  }

  for (const table of USER_TABLES) {
    const { data, error } = await adminSupabase.from(table).select('*').eq('user_id', user.id)
    bundle[table] = error ? { error: error.message } : (data ?? [])
  }

  // Ayrshare profile metadata only (never the profile key).
  const { data: ayr } = await adminSupabase
    .from('ayrshare_profiles')
    .select('title, ref_id, linked_platforms, created_at')
    .eq('user_id', user.id)
    .maybeSingle()
  bundle['ayrshare_profile'] = ayr ?? null

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="corvelle-export-${user.id}.json"`,
    },
  })
}
