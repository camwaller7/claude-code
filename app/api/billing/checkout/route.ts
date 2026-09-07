import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { getStripe, billingEnabled } from '@/lib/stripe/client'
import { getUserSubscription } from '@/lib/billing/subscription'
import { priceIdFor, type Interval } from '@/lib/billing/prices'
import type { Tier } from '@/lib/billing/tiers'

// Start a Stripe Checkout session for the signed-in user's subscription. Returns
// { url } for the browser to redirect to. Reuses the user's existing Stripe
// customer when we've already created one.
export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!billingEnabled()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 200 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Which tier + interval to buy (defaults keep the old single-price behaviour).
  const body = await request.json().catch(() => ({})) as { tier?: Tier; interval?: Interval }
  const tier: Tier = body.tier ?? 'growth'
  const interval: Interval = body.interval === 'year' ? 'year' : 'month'
  const priceId = priceIdFor(tier, interval)
  if (!priceId) {
    return NextResponse.json({ error: 'That plan isn’t available yet.' }, { status: 200 })
  }

  const stripe = getStripe()
  const origin = new URL(request.url).origin

  // Reuse a stored customer if we have one, else let Checkout create one and
  // prefill the email.
  const existing = await getUserSubscription(user.id)
  const customer = existing?.stripe_customer_id ?? undefined

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    // Bind the session to our user so the webhook can map customer -> user.
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    ...(customer ? { customer } : { customer_email: user.email ?? undefined }),
    allow_promotion_codes: true,
  })

  // Ensure a subscriptions row exists so the portal/gating have something to
  // read even before the webhook lands.
  await adminSupabase.from('subscriptions').upsert(
    { user_id: user.id, status: 'inactive', plan: 'free' },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  return NextResponse.json({ url: session.url })
}
