-- User-selectable app aesthetic: playground (default), studio, command
alter table settings
  add column if not exists brand_theme text not null default 'playground';
