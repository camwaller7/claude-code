import { NextRequest, NextResponse } from 'next/server'
import { parseSignedRequest } from '@/lib/platform/signedRequest'
import { deleteMetaUserData } from '@/lib/platform/metaDataDeletion'

// Meta Deauthorize Callback.
// Register this URL in App Settings → Basic → Deauthorize Callback URL. Meta
// POSTs a `signed_request` when a user removes the app; we verify it and delete
// the user's stored data (including the encrypted access token). Meta only
// needs a 200 here — no JSON body is required.
export async function POST(request: NextRequest) {
  let signedRequest = ''
  try {
    const form = await request.formData()
    signedRequest = form.get('signed_request')?.toString() ?? ''
  } catch {
    // fall through
  }

  const payload = parseSignedRequest(signedRequest, [
    process.env.META_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ])
  if (!payload?.user_id) {
    return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
  }

  try {
    await deleteMetaUserData(payload.user_id)
  } catch (err) {
    console.error('[meta-deauthorize] deletion failed:', err)
    // Still return 200 so Meta doesn't retry indefinitely; we've logged it.
  }

  return NextResponse.json({ ok: true })
}
