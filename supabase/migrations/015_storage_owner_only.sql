-- Migration 013 locked down every table via is_app_owner(), but storage.objects
-- was never included — the post-media bucket was still insert/delete-able by
-- ANY authenticated Supabase user (not just the owner), since Supabase's open
-- sign-up means anyone can get a valid "authenticated" JWT.
--
-- Read access stays public (`to public`) on purpose: published posts embed
-- these media URLs directly in requests to Instagram/Facebook/X/etc, and
-- those platforms fetch the URL server-side with no Supabase session at all.
-- Only insert/delete are tightened to the owner.

drop policy if exists "Authenticated users can upload post media" on storage.objects;
drop policy if exists "Authenticated users can delete their uploads" on storage.objects;

create policy "Owner can upload post media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-media' and is_app_owner());

create policy "Owner can delete post media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-media' and is_app_owner());
