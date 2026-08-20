import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { triageMessage } from '@/lib/anthropic/triage'
import { getValidToken, PlatformNotConnectedError, isTokenAuthError } from '@/lib/platform/tokens'

interface GmailHeader {
  name: string
  value: string
}

interface GmailPart {
  mimeType: string
  body: { data?: string }
  parts?: GmailPart[]
}

interface GmailMessage {
  id: string
  labelIds: string[]
  payload: {
    headers: GmailHeader[]
    body: { data?: string }
    parts?: GmailPart[]
  }
}

interface GmailThread {
  id: string
  messages: GmailMessage[]
}

function extractBody(payload: GmailMessage['payload']): string {
  // Try direct body first
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }
  // Search parts for text/plain, then text/html
  const parts = payload.parts ?? []
  const findPart = (parts: GmailPart[], mime: string): string | null => {
    for (const part of parts) {
      if (part.mimeType === mime && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      if (part.parts) {
        const found = findPart(part.parts, mime)
        if (found) return found
      }
    }
    return null
  }
  const plain = findPart(parts, 'text/plain')
  if (plain) return plain
  const html = findPart(parts, 'text/html')
  if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return ''
}

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim() || match[2], email: match[2] }
  return { name: from, email: from }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const token = await getValidToken('gmail')

    const listRes = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/threads?maxResults=20&q=in:inbox%20is:unread',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listJson = await listRes.json() as { threads?: Array<{ id: string }> }
    const threads = listJson.threads ?? []

    let synced = 0

    for (const { id: threadId } of threads) {
      const threadRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const thread = await threadRes.json() as GmailThread

      if (!thread.messages?.length) continue

      const firstMsg = thread.messages[0]
      const headers = firstMsg.payload.headers
      const subject = getHeader(headers, 'subject')
      const from = getHeader(headers, 'from')
      const { name: contactName, email: contactEmail } = parseFrom(from)

      // Upsert conversation
      const { data: conv } = await adminSupabase
        .from('conversations')
        .upsert(
          {
            platform: 'gmail',
            external_thread_id: threadId,
            contact_name: contactName,
            contact_handle: contactEmail,
            status: 'needs_reply',
            last_message_at: new Date().toISOString(),
          },
          { onConflict: 'platform,external_thread_id' }
        )
        .select()
        .single()

      if (!conv) continue

      // Insert inbound messages
      let lastInboundBody = ''
      for (const msg of thread.messages) {
        if (msg.labelIds?.includes('SENT')) continue

        const body = extractBody(msg.payload)
        lastInboundBody = body

        await adminSupabase.from('messages').upsert({
          conversation_id: conv.id,
          direction: 'inbound',
          body,
          external_message_id: msg.id,
          sent_at: new Date().toISOString(),
        }, { onConflict: 'external_message_id', ignoreDuplicates: true })

        synced++
      }

      // Triage on most recent inbound
      if (lastInboundBody) {
        const triage = await triageMessage(lastInboundBody, contactName, 'gmail')
        await adminSupabase
          .from('conversations')
          .update({
            category: triage.category,
            priority: triage.priority,
          })
          .eq('id', conv.id)
      }
    }

    return NextResponse.json({ synced })
  } catch (err) {
    // Gmail not connected, or its token was revoked/expired: nothing to sync.
    // Return 200 so the scheduled job treats it as a no-op instead of retrying
    // a "500" every cycle and flooding the logs.
    if (err instanceof PlatformNotConnectedError || isTokenAuthError(err)) {
      return NextResponse.json({
        skipped: true,
        reason: err instanceof PlatformNotConnectedError ? 'not_connected' : 'reauth_required',
        platform: 'gmail',
      })
    }
    console.error('Gmail sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
