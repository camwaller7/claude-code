import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { adminSupabase } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { addCredits } from '@/lib/billing/credits'

// Stripe webhook: the source of truth for subscription state. Verifies the
// signature, then upserts the subscriptions table so the app's plan gating and
// per-user entitlements reflect Stripe. Always 200 on handled events so Stripe
// doesn't retry a successfully-processed delivery.

export const dynamic = 'force-dynamic'

// Newer Stripe API versions moved current_period_end onto subscription items;
// read whichever is present.
function periodEndISO(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end
  const item = sub.items?.data?.[0]?.current_period_end
  const ts = top ?? item
  return ts ? new Date(ts * 1000).toISOString() : null
}

// Map the subscription's price to our tier + billing interval. Tier comes from
// the price's metadata.tier (set on each Stripe Price: starter|growth|pro);
// interval from the price's recurring.interval (month|year).
function tierAndIntervalFromSub(sub: Stripe.Subscription): { tier: string; interval: string } {
  const price = sub.items?.data?.[0]?.price
  const tier = (price?.metadata?.tier as string | undefined) ?? 'starter'
  const interval = price?.recurring?.interval ?? 'month'
  return { tier, interval }
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null
  // Prefer the user id from metadata; fall back to matching an existing row by
  // customer id (e.g. events without our metadata).
  let targetUserId: string | undefined = userId
  if (!targetUserId && customerId) {
    const { data } = await adminSupabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    targetUserId = (data?.user_id as string | undefined) ?? undefined
  }
  if (!targetUserId) {
    console.warn('[stripe-webhook] could not map subscription to a user', sub.id)
    return
  }

  const active = ['active', 'trialing', 'past_due'].includes(sub.status)
  const { tier, interval } = tierAndIntervalFromSub(sub)
  await adminSupabase.from('subscriptions').upsert(
    {
      user_id: targetUserId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan: active ? tier : 'free',
      tier: active ? tier : 'starter',
      billing_interval: interval,
      status: sub.status,
      current_period_end: periodEndISO(sub),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 200 })
  }

  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // One-time usage top-up: grant the credits carried in the metadata.
        if (session.mode === 'payment' && session.metadata?.credit_kind) {
          const userId = session.metadata.user_id || session.client_reference_id
          if (userId) {
            await addCredits(
              userId,
              Number(session.metadata.grant_interactions ?? 0),
              Number(session.metadata.grant_opus_cents ?? 0)
            )
          }
          break
        }

        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(subId)
          // Ensure metadata carries our user id for later events.
          if (!sub.metadata?.user_id && session.client_reference_id) {
            sub.metadata = { ...sub.metadata, user_id: session.client_reference_id }
          }
          await upsertFromSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertFromSubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        // Unhandled event types are fine — acknowledge them.
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err)
    return NextResponse.json({ error: 'handler_error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
