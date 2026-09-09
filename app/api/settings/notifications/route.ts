import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { scopedUserId } from '@/lib/auth/currentUser'
import { saveNotifyChannel, type NotifyChannel } from '@/lib/notifications/notify'

const VALID: NotifyChannel[] = ['in_app', 'email', 'both', 'off']

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json().catch(() => ({}))) as { channel?: string }
    if (!body.channel || !VALID.includes(body.channel as NotifyChannel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
    }
    const saved = await saveNotifyChannel(await scopedUserId(), body.channel as NotifyChannel)
    return NextResponse.json({ channel: saved })
  } catch (e) {
    console.error('[settings/notifications]', e)
    return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 })
  }
}
