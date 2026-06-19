-- Public bucket for post media (images/videos uploaded before publishing)
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload and read
create policy "Authenticated users can upload post media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-media');

create policy "Post media is publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'post-media');

create policy "Authenticated users can delete their uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-media');
