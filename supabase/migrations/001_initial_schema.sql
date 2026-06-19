create table platform_connections (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  connected_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_thread_id text not null,
  contact_name text not null default '',
  contact_handle text not null default '',
  category text not null default 'uncategorized',
  status text not null default 'needs_reply',
  priority integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, external_thread_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  ai_category text,
  ai_draft_reply text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  brand_name text not null,
  contact_name text not null default '',
  status text not null default 'inquiry',
  deal_value numeric,
  currency text not null default 'USD',
  agreed_date date,
  payment_due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  name text not null,
  handle text not null default '',
  product_purchased text not null default '',
  purchase_date date,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '',
  hashtags text not null default '',
  media_url text,
  platforms text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'draft',
  published_at timestamptz,
  platform_post_ids jsonb,
  created_at timestamptz not null default now()
);

create index on conversations (platform);
create index on conversations (status);
create index on conversations (last_message_at desc);
create index on messages (conversation_id);
create index on deals (status);
create index on posts (scheduled_at);
