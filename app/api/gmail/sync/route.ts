import { NextResponse } from 'next/server'

// Will use Gmail API with OAuth tokens stored in platform_connections table.
// Requires: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI env vars
// and a connected account with refresh token stored in Supabase.
export async function POST() {
  return NextResponse.json(
    { message: 'Gmail sync not yet implemented' },
    { status: 501 }
  )
}
