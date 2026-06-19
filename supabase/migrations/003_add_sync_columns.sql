alter table conversations
  add column if not exists subject text;

alter table messages
  add column if not exists external_message_id text;

create index if not exists messages_external_message_id_idx on messages(external_message_id)
  where external_message_id is not null;

alter table conversations
  add constraint conversations_platform_external_thread_id_key
  unique (platform, external_thread_id);
