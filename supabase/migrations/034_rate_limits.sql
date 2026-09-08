-- ─── API rate limiting (audit M5) ────────────────────────────────────────────
-- A fixed-window limiter backed by Postgres so it works across serverless
-- instances (in-memory counters don't survive Vercel's per-request isolation).
-- Each (key, window) bucket is incremented atomically; the RPC returns whether
-- the caller is still under the limit. Additive and safe in both modes.

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- Record a hit against p_key's current fixed window and report whether the
-- caller is still allowed. p_window_seconds sizes the window; p_limit is the max
-- hits per window. Atomic check-and-increment so bursts can't slip past.
create or replace function rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz;
  c integer;
begin
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (key, window_start, count)
  values (p_key, w, 1)
  on conflict (key, window_start) do update
    set count = rate_limits.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

-- Housekeeping: drop windows older than a day so the table stays small. Called
-- opportunistically; safe to run anytime.
create or replace function prune_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;
