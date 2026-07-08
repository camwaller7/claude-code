-- AI assistant persona — the character the creator names and customizes
alter table settings
  add column if not exists assistant_name text not null default 'Nova',
  add column if not exists assistant_emoji text not null default '✨',
  add column if not exists assistant_vibe text not null default 'friendly';
