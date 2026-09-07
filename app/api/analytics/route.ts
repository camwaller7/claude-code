import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { getContentAnalytics } from '@/lib/analytics/stats'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const analytics = await getContentAnalytics(await scopedUserId())
    return NextResponse.json(analytics)
  } catch (e) {
    console.error('[analytics]', e)
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 })
  }
}
