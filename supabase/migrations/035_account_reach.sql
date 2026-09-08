-- ─── Account reach (7-day, per platform) ─────────────────────────────────────
-- Stores a rolling 7-day reach total per connected account, refreshed by the
-- analytics sync. Reach comes from Zernio's per-platform account-insights
-- endpoints and isn't part of the per-post content_metrics, so it lives here.
-- owner_key is the user id (multi-user) or the literal 'pilot' (single-tenant),
-- so one row per account works in both modes. Written by the service role only.

create table if not exists account_reach (
  owner_key text not null,
  platform text not null,
  reach_7d integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_key, platform)
);

alter table account_reach enable row level security;
-- Read/write is service-role only (the dashboard reads via the admin client and
-- the sync writes via the admin client), so no authenticated policy is granted.
