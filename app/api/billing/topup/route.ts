import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { getStripe, billingEnabled } from '@/lib/stripe/client'
import { TOPUPS, type TopupKind } from '@/lib/billing/credits'

// Buy a one-time usage top-up pack. Returns { url } for Stripe Checkout in
// payment mode; the webhook grants the credits on completion. The grant amounts
// are carried in the session metadata so the webhook is self-contained.
export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!billingEnabled()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 200 })
  }

  const body = await request.json().catch(() => ({})) as { kind?: TopupKind }
  const pack = body.kind ? TOPUPS[body.kind] : undefined
  if (!pack) return NextResponse.json({ error: 'Unknown top-up.' }, { status: 200 })

  const priceId = process.env[pack.priceEnv]
  if (!priceId) return NextResponse.json({ error: 'This top-up isn’t available yet.' }, { status: 200 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  const origin = new URL(request.url).origin
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?topup=success`,
    cancel_url: `${origin}/billing?topup=cancelled`,
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: {
      user_id: user.id,
      credit_kind: pack.kind,
      grant_interactions: String(pack.grantInteractions),
      grant_opus_cents: String(pack.grantOpusCents),
    },
  })

  return NextResponse.json({ url: session.url })
}
