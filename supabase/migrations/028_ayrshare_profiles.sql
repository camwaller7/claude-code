-- ─── Ayrshare publishing profiles ────────────────────────────────────────────
-- Each app user maps to exactly one Ayrshare "user profile" (profileKey). The
-- user links their own social accounts through Ayrshare's hosted SSO page, and
-- the post portal publishes on their behalf using this key. This is what makes
-- multi-user publishing work without per-user Meta App Review.
--
-- The profileKey is a capability secret (anyone holding it can post as that
-- user), so it is only ever read/written by the service role. Authenticated
-- users may read their own row's metadata (to know whether they've connected)
-- but the key itself is never sent to the browser.

create table if not exists ayrshare_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_key text not null,
  ref_id text,
  title text,
  -- Cached list of linked platform slugs (our internal names) for quick display
  -- without a round-trip to Ayrshare on every page load. Refreshed on connect.
  linked_platforms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ayrshare_profiles_profile_key_idx on ayrshare_profiles(profile_key);

alter table ayrshare_profiles enable row level security;

-- Users may read their own profile metadata; only the service role writes it,
-- so no insert/update policy is granted to authenticated users.
drop policy if exists "ayrshare_profiles read own" on ayrshare_profiles;
create policy "ayrshare_profiles read own" on ayrshare_profiles
  for select to authenticated using (user_id = auth.uid());
