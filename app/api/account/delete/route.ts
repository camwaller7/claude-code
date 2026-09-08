import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { ayrshareEnabled, deleteAyrshareProfile } from '@/lib/platform/ayrshare'
import { getStoredAyrshareProfile } from '@/lib/platform/ayrshareProfile'
import { auditLog } from '@/lib/audit/log'

// Account deletion (audit M6). Removes the user's Ayrshare profile (external),
// then deletes their auth user — which cascades every per-user table via the
// ON DELETE CASCADE FKs (audit_log is preserved as SET NULL by design). The
// caller must confirm to avoid accidental deletion.
export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { confirm?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  if (body.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation required: send { "confirm": "DELETE" }.' },
      { status: 400 }
    )
  }

  // Best-effort external cleanup first so we don't leave an orphaned Ayrshare
  // profile if the auth deletion succeeds.
  if (ayrshareEnabled()) {
    const profile = await getStoredAyrshareProfile(user.id)
    if (profile) {
      const res = await deleteAyrshareProfile(profile.profile_key)
      if (!res.ok) {
        console.error('[account/delete] Ayrshare profile delete failed:', res.error)
      }
    }
  }

  await auditLog('account_deleted', { user_id: user.id, email: user.email })

  // Deleting the auth user cascades all user_id-owned rows.
  const { error } = await adminSupabase.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Clear the now-invalid session cookie.
  await supabase.auth.signOut().catch(() => {})

  return NextResponse.json({ deleted: true })
}
