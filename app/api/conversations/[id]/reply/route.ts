import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/platform/tokens'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { body } = await request.json() as { body: string }

  // Fetch conversation to know platform
  const { data: conv, error: convError } = await adminSupabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Insert outbound message
  const { data: msg, error } = await adminSupabase
    .from('messages')
    .insert({
      conversation_id: id,
      direction: 'outbound',
      body,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminSupabase
    .from('conversations')
    .update({ status: 'replied', last_message_at: new Date().toISOString() })
    .eq('id', id)

  // Send via platform
  try {
    if (conv.platform === 'instagram' || conv.platform === 'facebook') {
      const { data: conn } = await adminSupabase
        .from('platform_connections')
        .select('access_token')
        .eq('platform', conv.platform)
        .limit(1)
        .single()

      if (conn) {
        await fetch(
          `https://graph.facebook.com/v21.0/me/messages?access_token=${conn.access_token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: conv.external_thread_id },
              message: { text: body },
            }),
          }
        )
      }
    } else if (conv.platform === 'x') {
      const token = await getValidToken('x')
      await fetch(
        `https://api.twitter.com/2/dm_conversations/${conv.external_thread_id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: body }),
        }
      )
    } else if (conv.platform === 'gmail') {
      const token = await getValidToken('gmail')

      // Fetch thread to get last message-id header
      const threadRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/threads/${conv.external_thread_id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const thread = await threadRes.json() as {
        messages: Array<{
          payload: { headers: Array<{ name: string; value: string }> }
        }>
      }

      const lastMsg = thread.messages?.[thread.messages.length - 1]
      const headers = lastMsg?.payload?.headers ?? []
      const msgId = headers.find((h) => h.name.toLowerCase() === 'message-id')?.value ?? ''
      const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''

      const raw = [
        `To: <${conv.contact_handle}>`,
        `Subject: Re: ${subject}`,
        msgId ? `In-Reply-To: ${msgId}` : '',
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ]
        .filter((line) => line !== null)
        .join('\r\n')

      const encoded = Buffer.from(raw).toString('base64url')

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded, threadId: conv.external_thread_id }),
      })
    }
    // threads/tiktok: DB only, no send
  } catch (sendErr) {
    console.error('Platform send error:', sendErr)
    // Still return success since DB write succeeded
  }

  return NextResponse.json(msg, { status: 201 })
}
