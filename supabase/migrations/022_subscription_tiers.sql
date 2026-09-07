-- ─── Subscription tiers ───────────────────────────────────────────────────────
-- Adds the tier and billing-interval columns the pricing model needs. Opus
-- weekly usage and Starter daily usage are computed on the fly from token_usage
-- (which carries user_id + model + created_at), so no counter columns or reset
-- job are required — a call simply sums the current week/day window.

alter table subscriptions add column if not exists tier text not null default 'starter';
alter table subscriptions add column if not exists billing_interval text not null default 'month';

-- Backfill: any existing active row created before tiers becomes 'growth'
-- (the main tier) so early access isn't downgraded; inactive stays starter.
update subscriptions set tier = 'growth' where status in ('active', 'trialing') and tier = 'starter';
