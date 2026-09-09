-- ─── Stored notifications + delivery preference ─────────────────────────────
-- The notification bell has, until now, only shown *derived* reminders
-- (getReminders recomputes current-state nudges on every poll). A "your post is
-- live" alert is different: it's a discrete event that happened at a point in
-- time and must be stored so it can be shown once, marked read, and — when the
-- user opts in — emailed. This adds that store plus a per-user delivery channel.
--
-- Additive and safe in both modes:
--   • notifications.user_id is nullable so the single-tenant pilot (rows carry
--     no user_id) writes and reads exactly as it does elsewhere, via the admin
--     client scoped by scopedUserId().
--   • notify_channel is added to BOTH user_settings (multi-user) and the global
--     settings row (pilot), mirroring how persona/theme are routed.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  meta jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);
-- Unread-first lookups (the bell badge).
create index if not exists notifications_unread_idx
  on notifications (user_id, created_at desc) where read_at is null;

alter table notifications enable row level security;
drop policy if exists "notifications own" on notifications;
create policy "notifications own" on notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delivery preference: where a user wants to be notified.
--   in_app = dropdown bell only · email = email only · both · off = suppressed
-- user_settings only exists once the cutover migration (033) has run, so this is
-- guarded to stay applyable in the single-tenant pilot (where it's a no-op) and
-- after cutover alike, in any order relative to 033.
do $$ begin
  if to_regclass('public.user_settings') is not null then
    alter table user_settings
      add column if not exists notify_channel text not null default 'both';
    begin
      alter table user_settings
        add constraint user_settings_notify_channel_chk
        check (notify_channel in ('in_app','email','both','off'));
    exception when duplicate_object then null; end;
  end if;
end $$;

alter table settings
  add column if not exists notify_channel text not null default 'both';
do $$ begin
  alter table settings
    add constraint settings_notify_channel_chk
    check (notify_channel in ('in_app','email','both','off'));
exception when duplicate_object then null; end $$;
