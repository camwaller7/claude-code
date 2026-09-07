-- Safe hardening migration (additive; does not change single-tenant behaviour).
-- Addresses audit findings M10 (audit_log cascade), M11 (composite indexes),
-- and H9 (a guard against silently-unowned rows).

-- ── M10: audit_log must survive user deletion ────────────────────────────────
-- 021 made every user_id FK `on delete cascade`, which would wipe a user's
-- audit trail when their account is deleted — defeating the append-only
-- security record. Re-point audit_log's FK to SET NULL so the entries persist.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'audit_log'::regclass and contype = 'f'
    and pg_get_constraintdef(oid) like '%user_id%references auth.users%';
  if fk_name is not null then
    execute format('alter table audit_log drop constraint %I', fk_name);
  end if;
  alter table audit_log
    add constraint audit_log_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
end $$;

-- ── M11: composite indexes for the hot multi-tenant query paths ──────────────
create index if not exists idx_conversations_user_status on conversations (user_id, status);
create index if not exists idx_messages_conversation_sent on messages (conversation_id, sent_at);
create index if not exists idx_token_usage_user_created on token_usage (user_id, created_at);

-- ── H9: guard against silently-unowned rows ──────────────────────────────────
-- 021's backfill silently no-ops if app_owner was empty/mismatched, leaving
-- pre-existing rows with user_id = NULL (invisible under per-user RLS). This
-- function lets an operator verify before enabling multi-user; it RAISES if any
-- per-user table still has NULL user_id rows. Call: `select assert_all_rows_owned();`
create or replace function assert_all_rows_owned()
returns void
language plpgsql
as $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'conversations','messages','deals','clients','posts',
    'content_metrics','follower_snapshots','token_usage'
  ]
  loop
    execute format('select count(*) from %I where user_id is null', t) into n;
    if n > 0 then
      raise exception 'Table % has % rows with NULL user_id — backfill before enabling multi-user', t, n;
    end if;
  end loop;
end $$;
