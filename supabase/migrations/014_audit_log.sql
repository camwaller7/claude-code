-- Append-only audit trail of security-sensitive actions: sign-ins, password
-- changes, platform connections, settings changes, and data mutations made
-- via the AI assistant (since those bypass the normal UI review step).
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text,
  action text not null,
  detail jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index on audit_log(created_at desc);
create index on audit_log(action);

alter table audit_log enable row level security;
-- Owner can read it via the app; nothing can write to it except the
-- service-role key (server-side only) — the app never lets end-user input
-- author its own audit trail.
revoke all on audit_log from anon, authenticated;
create policy "audit_log owner read" on audit_log for select to authenticated using (is_app_owner());
