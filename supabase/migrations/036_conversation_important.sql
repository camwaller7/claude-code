-- ─── Important flag on conversations ─────────────────────────────────────────
-- Lets a creator mark DMs that matter (real reply-worthy messages) so they sort
-- to the top of the inbox and don't get lost among fan/spam DMs. A simple
-- per-conversation boolean the user toggles from the inbox.

alter table conversations add column if not exists is_important boolean not null default false;

-- Partial index for the "important first" ordering / important-only filter.
create index if not exists conversations_important_idx
  on conversations (is_important)
  where is_important;
