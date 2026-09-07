import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { getReminders } from '@/lib/reminders/engine'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const reminders = await getReminders(await scopedUserId())
    return NextResponse.json({ reminders })
  } catch (e) {
    console.error('[reminders]', e)
    return NextResponse.json({ error: 'Failed to load reminders' }, { status: 500 })
  }
}
