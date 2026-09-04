-- ─── Multi-user tenancy foundation ───────────────────────────────────────────
-- Converts the single-owner app to multi-tenant. Adds a user_id owner column to
-- every per-user table, backfills existing rows to the current pilot owner, and
-- replaces the owner-only RLS policies with per-user isolation
-- (user_id = auth.uid()).
--
-- This migration is ADDITIVE and non-breaking for the running app: the API
-- routes use the Supabase service-role client, which bypasses RLS, so they keep
-- seeing all rows until each route is updated to scope by user_id. The new RLS
-- only tightens direct (anon/authenticated JWT) access, which is what we want.
--
-- Safe to run once. Re-running is guarded by IF NOT EXISTS / idempotent policy
-- recreation.

-- 1. The pilot owner's auth user id (from the app_owner email → auth.users).
--    Used to backfill every existing row to that owner.
do $$
declare
  owner_id uuid;
  t text;
begin
  select u.id into owner_id
  from auth.users u
  join app_owner o on lower(o.email) = lower(u.email)
  limit 1;

  -- 2. Add user_id to every per-user table and backfill existing rows.
  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'settings', 'token_usage',
    'follower_snapshots', 'content_metrics', 'audit_log'
  ]
  loop
    execute format('alter table %I add column if not exists user_id uuid references auth.users(id) on delete cascade', t);
    if owner_id is not null then
      execute format('update %I set user_id = %L where user_id is null', t, owner_id);
    end if;
    execute format('create index if not exists %I on %I(user_id)', t || '_user_id_idx', t);
  end loop;
end $$;

-- 3. Replace owner-only RLS with per-user isolation on every per-user table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'settings', 'token_usage',
    'follower_snapshots', 'content_metrics', 'audit_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    -- Drop the previous owner-only and legacy policies if present.
    execute format('drop policy if exists %I on %I', t || ' owner only', t);
    execute format('drop policy if exists %I on %I', t || ' auth access', t);
    execute format('drop policy if exists %I on %I', t || ' per user', t);
    -- Each user sees and writes only their own rows.
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || ' per user', t
    );
  end loop;
end $$;

-- 4. Map each app user to the Zernio social account(s) they connected. The
--    inbound webhook uses account.id to route a message to its owning user, and
--    the reply path uses it to pick the sending account. One row per connected
--    (user, platform, zernio account).
create table if not exists zernio_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zernio_account_id text not null,
  platform text not null,
  username text,
  display_name text,
  connected_at timestamptz not null default now(),
  unique (zernio_account_id)
);
create index if not exists zernio_accounts_user_id_idx on zernio_accounts(user_id);
create index if not exists zernio_accounts_account_idx on zernio_accounts(zernio_account_id);

alter table zernio_accounts enable row level security;
drop policy if exists "zernio_accounts per user" on zernio_accounts;
create policy "zernio_accounts per user" on zernio_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Per-user subscription/plan state for billing (Stripe). Populated by the
--    Stripe webhook in a later step; free/no-row means no active paid plan.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table subscriptions enable row level security;
drop policy if exists "subscriptions read own" on subscriptions;
-- Users may read their own subscription; only the service role (Stripe webhook)
-- writes it, so no insert/update policy is granted to authenticated users.
create policy "subscriptions read own" on subscriptions
  for select to authenticated using (user_id = auth.uid());
