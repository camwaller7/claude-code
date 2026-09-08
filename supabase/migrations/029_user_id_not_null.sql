-- ─── Cutover step 2–3: enforce ownership (NOT NULL user_id) ───────────────────
-- APPLY AT CUTOVER ONLY, together with flipping MULTIUSER_ENABLED=true. Do NOT
-- apply while the single-tenant pilot is still writing rows without user_id —
-- pilot inserts omit user_id, so enforcing NOT NULL first would break them.
--
-- Order (see docs/MULTIUSER_CUTOVER.md):
--   029 (this) → 030 composite keys → 031 remove is_app_owner() RLS bypass.
--
-- This migration (a) backfills any straggler rows to the owner, (b) verifies no
-- unowned rows remain via assert_all_rows_owned() (raises if so), then (c) makes
-- user_id NOT NULL on every cleanly per-user table. settings (global row until
-- per-user settings land) and audit_log (user_id is SET NULL on delete by
-- design, migration 027) are intentionally excluded.

-- (a) Backfill stragglers created after migration 021's initial backfill.
do $$
declare
  owner_id uuid;
  t text;
begin
  select u.id into owner_id
  from auth.users u
  join app_owner o on lower(o.email) = lower(u.email)
  limit 1;

  if owner_id is null then
    raise exception 'No app_owner mapped to an auth user — set OWNER_EMAIL / app_owner before cutover';
  end if;

  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'token_usage', 'follower_snapshots', 'content_metrics'
  ]
  loop
    execute format('update %I set user_id = %L where user_id is null', t, owner_id);
  end loop;
end $$;

-- (b) Verify nothing is left unowned (raises with the offending table if so).
select assert_all_rows_owned();

-- (c) Enforce NOT NULL now that every row is owned.
do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'token_usage', 'follower_snapshots', 'content_metrics'
  ]
  loop
    execute format('alter table %I alter column user_id set not null', t);
  end loop;
end $$;
