-- ─── owner_user_id(): resolve the app owner's auth user id ───────────────────
-- The inbound webhook must never write a row without a user_id once the cutover
-- makes user_id NOT NULL. Accounts a trial creator connects are mapped to their
-- own user via zernio_accounts, but the OWNER's legacy pilot accounts were
-- connected before that table existed, so they have no mapping. This function
-- resolves the owner's auth user id (app_owner.email → auth.users) so unmapped
-- accounts can be safely attributed to the owner instead of writing unowned.
--
-- SECURITY DEFINER to read auth.users; execution locked to service_role only
-- (the app calls it through the service-role client), so it is not reachable by
-- ordinary signed-in users via PostgREST.

create or replace function public.owner_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  join app_owner o on lower(o.email) = lower(u.email)
  limit 1
$$;

revoke all on function public.owner_user_id() from public, anon, authenticated;
grant execute on function public.owner_user_id() to service_role;
