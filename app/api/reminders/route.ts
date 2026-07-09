import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getReminders } from '@/lib/reminders/engine'

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const reminders = await getReminders()
    return NextResponse.json({ reminders })
  } catch (e) {
    console.error('[reminders]', e)
    return NextResponse.json({ error: 'Failed to load reminders' }, { status: 500 })
  }
}
