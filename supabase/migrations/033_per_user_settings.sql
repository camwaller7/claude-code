-- ─── Per-user settings (audit L8) ────────────────────────────────────────────
-- Assistant persona (name/emoji/vibe) and the app theme are personal
-- preferences, but they lived on the single global `settings` row (id=1), so in
-- multi-user every user shared one persona/theme. Move those to a per-user
-- table. The LLM provider/model stay on the global row — they're platform-
-- controlled for cost, not a user preference.
--
-- Additive and safe in both modes: the global settings columns are left in
-- place (the single-tenant pilot keeps reading them); multi-user reads/writes
-- user_settings instead (lib/settings/userSettings.ts routes by mode).

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assistant_name text not null default 'Nova',
  assistant_emoji text not null default '✨',
  assistant_vibe text not null default 'friendly',
  brand_theme text not null default 'playground',
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;
drop policy if exists "user_settings own" on user_settings;
create policy "user_settings own" on user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Seed the owner's row from the current global settings so nothing visibly
-- changes for them at cutover.
do $$
declare
  owner_id uuid;
begin
  select u.id into owner_id
  from auth.users u
  join app_owner o on lower(o.email) = lower(u.email)
  limit 1;

  if owner_id is not null then
    insert into user_settings (user_id, assistant_name, assistant_emoji, assistant_vibe, brand_theme)
    select owner_id, s.assistant_name, s.assistant_emoji, s.assistant_vibe, s.brand_theme
    from settings s
    where s.id = 1
    on conflict (user_id) do nothing;
  end if;
end $$;
