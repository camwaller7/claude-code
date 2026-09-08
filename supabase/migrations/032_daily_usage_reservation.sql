-- ─── Atomic daily-interaction reservation (audit H2) ─────────────────────────
-- The Starter daily cap was enforced by counting historical token_usage rows,
-- which are written AFTER the model call. Concurrent requests all read the same
-- pre-write count and each pass the check, bursting past the cap. This adds a
-- counter that is incremented atomically BEFORE dispatch, so the Nth+1 request
-- of the day is refused even under concurrency.
--
-- Additive and safe in both single-tenant and multi-user modes. token_usage
-- logging stays as-is for reporting/analytics; this table is only the gate.

create table if not exists daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table daily_usage enable row level security;
drop policy if exists "daily_usage read own" on daily_usage;
create policy "daily_usage read own" on daily_usage
  for select to authenticated using (user_id = auth.uid());

-- Reserve one interaction for today if under p_cap. Returns the new count when
-- the reservation succeeds, or NULL when the cap is already reached (so the
-- caller blocks or falls back to purchased credits). The `where count < p_cap`
-- on the conflict path makes the check-and-increment a single atomic statement.
create or replace function reserve_daily_interaction(p_user_id uuid, p_cap integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into daily_usage (user_id, day, count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = daily_usage.count + 1
    where daily_usage.count < p_cap
  returning count into new_count;
  return new_count; -- NULL when the cap blocked the update
end $$;
