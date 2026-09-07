-- Idempotency for Stripe webhook events. Stripe redelivers events on any non-2xx
-- or network hiccup; without this, an incrementing action (top-up credit grant)
-- can be applied more than once. The webhook records each processed event id and
-- no-ops on a duplicate.
create table if not exists stripe_processed_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- Service-role only (the webhook). No authenticated access.
alter table stripe_processed_events enable row level security;
revoke all on stripe_processed_events from anon, authenticated;
