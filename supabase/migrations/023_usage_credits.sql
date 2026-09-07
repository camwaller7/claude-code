-- ─── Usage top-up credits ─────────────────────────────────────────────────────
-- Lets a user buy extra usage when their tier allowance runs out:
--   interaction_credits  — extra AI actions beyond the Starter daily cap
--   opus_credit_cents    — extra Opus API spend beyond the Pro weekly cap
-- Credits are a persistent pool (they don't reset with the daily/weekly window);
-- the model router consumes them only once the included allowance is exhausted.
-- Written by the Stripe webhook (service role); users may read their own balance.

create table if not exists user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  interaction_credits integer not null default 0,
  opus_credit_cents integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table user_credits enable row level security;
drop policy if exists "user_credits read own" on user_credits;
create policy "user_credits read own" on user_credits
  for select to authenticated using (user_id = auth.uid());

-- Atomic increment helper so top-ups add to (never overwrite) the balance, and
-- concurrent grants don't clobber each other.
create or replace function add_user_credits(p_user_id uuid, p_interactions integer, p_opus_cents integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into user_credits (user_id, interaction_credits, opus_credit_cents)
  values (p_user_id, greatest(p_interactions, 0), greatest(p_opus_cents, 0))
  on conflict (user_id) do update
    set interaction_credits = user_credits.interaction_credits + greatest(p_interactions, 0),
        opus_credit_cents   = user_credits.opus_credit_cents + greatest(p_opus_cents, 0),
        updated_at = now();
$$;

-- Atomic decrement (floored at 0) for consuming credits at call time.
create or replace function consume_user_credits(p_user_id uuid, p_interactions integer, p_opus_cents integer)
returns void
language sql
security definer
set search_path = public
as $$
  update user_credits
    set interaction_credits = greatest(interaction_credits - greatest(p_interactions, 0), 0),
        opus_credit_cents   = greatest(opus_credit_cents - greatest(p_opus_cents, 0), 0),
        updated_at = now()
  where user_id = p_user_id;
$$;
