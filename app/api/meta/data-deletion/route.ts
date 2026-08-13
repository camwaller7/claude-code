import { NextRequest, NextResponse } from 'next/server'
import { parseSignedRequest } from '@/lib/platform/signedRequest'
import { deleteMetaUserData } from '@/lib/platform/metaDataDeletion'

// Meta Data Deletion Request Callback.
// Register this URL in App Settings → Basic → User Data Deletion (Callback URL).
// Meta POSTs a `signed_request`; we verify it, delete the user's stored data,
// and return the required { url, confirmation_code } JSON so the user can check
// deletion status.
export async function POST(request: NextRequest) {
  let signedRequest = ''
  try {
    const form = await request.formData()
    signedRequest = form.get('signed_request')?.toString() ?? ''
  } catch {
    // Some senders use urlencoded/JSON — fall through to the empty check.
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
    console.error('[meta-data-deletion] deletion failed:', err)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }

  const confirmationCode = `del_${payload.user_id}`
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  return NextResponse.json({
    url: `${base}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
