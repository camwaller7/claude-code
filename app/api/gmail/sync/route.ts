import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { message: 'Gmail sync not yet implemented' },
    { status: 501 }
  )
}
