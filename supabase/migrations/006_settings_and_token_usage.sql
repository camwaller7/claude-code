create table if not exists settings (
  id integer primary key default 1,
  llm_provider text not null default 'anthropic',
  llm_model text not null default 'claude-sonnet-4-6',
  constraint single_row check (id = 1)
);

insert into settings (id, llm_provider, llm_model) values (1, 'anthropic', 'claude-sonnet-4-6')
on conflict (id) do nothing;

create table if not exists token_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  feature text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index on token_usage(created_at desc);
create index on token_usage(provider);
create index on token_usage(feature);

alter table settings enable row level security;
create policy "settings auth access" on settings for all to authenticated using (true) with check (true);

alter table token_usage enable row level security;
create policy "token_usage auth access" on token_usage for all to authenticated using (true) with check (true);
