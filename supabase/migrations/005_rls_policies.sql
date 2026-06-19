-- Enable RLS and add permissive policies for the single authenticated user

alter table conversations enable row level security;
create policy "conversations auth access" on conversations for all to authenticated using (true) with check (true);

alter table messages enable row level security;
create policy "messages auth access" on messages for all to authenticated using (true) with check (true);

alter table deals enable row level security;
create policy "deals auth access" on deals for all to authenticated using (true) with check (true);

alter table clients enable row level security;
create policy "clients auth access" on clients for all to authenticated using (true) with check (true);

alter table posts enable row level security;
create policy "posts auth access" on posts for all to authenticated using (true) with check (true);

alter table platform_connections enable row level security;
create policy "platform_connections auth access" on platform_connections for all to authenticated using (true) with check (true);
