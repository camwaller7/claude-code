-- Fix upsert failures: ON CONFLICT requires real unique constraints.

-- messages.external_message_id — used by gmail/x sync upserts
-- (drop the old non-unique partial index if present)
drop index if exists messages_external_message_id_idx;
create unique index if not exists messages_external_message_id_key
  on messages (external_message_id);

-- platform_connections (platform, account_id) — used by all OAuth callbacks
alter table platform_connections drop constraint if exists platform_connections_platform_key;
alter table platform_connections
  add constraint platform_connections_platform_account_key unique (platform, account_id);

-- Enable realtime for the inbox (RealtimeInbox subscribes to messages/conversations)
do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table conversations;
exception when duplicate_object then null;
end $$;
