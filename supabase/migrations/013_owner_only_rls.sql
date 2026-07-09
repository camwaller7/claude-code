-- Defense-in-depth: RLS previously granted ANY authenticated user full
-- access ("to authenticated using (true)"). That means anyone who signs up
-- with their own email via the public magic-link flow gets full read/write
-- on every DM, deal, client and setting — the app-level OWNER_EMAIL check
-- protects the app's own routes, but a raw call to the Supabase REST API
-- with a non-owner JWT would still get through the old policies.
--
-- This migration replaces every "to authenticated using (true)" policy with
-- one scoped to a single owner email, read from the `app_owner` table below.
--
-- ACTION REQUIRED after running this: insert your login email —
--   insert into app_owner (email) values ('you@example.com');
-- Nothing will work for anyone (including you) until that row exists.

create table if not exists app_owner (
  email text primary key
);
alter table app_owner enable row level security;
-- No one can read/write this table via the API at all — it's checked
-- server-side only, inside the policy functions below.
revoke all on app_owner from anon, authenticated;

create or replace function is_app_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from app_owner
    where lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'settings', 'token_usage',
    'follower_snapshots', 'content_metrics'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || ' auth access', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_app_owner()) with check (is_app_owner())',
      t || ' owner only', t
    );
  end loop;
end $$;
