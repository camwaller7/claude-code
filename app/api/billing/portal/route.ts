import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { createServerClient } from '@/lib/supabase/server'
import { getStripe, billingEnabled } from '@/lib/stripe/client'
import { getUserSubscription } from '@/lib/billing/subscription'

// Open the Stripe customer portal so the user can manage/cancel their plan or
// update payment details. Returns { url } to redirect to.
export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  if (!billingEnabled()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 200 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await getUserSubscription(user.id)
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account yet — subscribe first.' }, { status: 200 })
  }

  const stripe = getStripe()
  const origin = new URL(request.url).origin
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/billing`,
  })
  return NextResponse.json({ url: session.url })
}
