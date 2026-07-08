-- Social analytics: follower history + per-post performance metrics.
-- Populated by platform syncs (Instagram/Facebook/X insights) or demo seed.

create table if not exists follower_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  followers integer not null,
  snapshot_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (platform, snapshot_date)
);

create index on follower_snapshots(platform, snapshot_date desc);

create table if not exists content_metrics (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_post_id text,
  caption text,
  media_type text not null default 'image', -- image | video | reel | carousel | text
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  follows_gained integer not null default 0,
  posted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (platform, external_post_id)
);

create index on content_metrics(posted_at desc);
create index on content_metrics(platform);

alter table follower_snapshots enable row level security;
create policy "follower_snapshots auth access" on follower_snapshots for all to authenticated using (true) with check (true);

alter table content_metrics enable row level security;
create policy "content_metrics auth access" on content_metrics for all to authenticated using (true) with check (true);
