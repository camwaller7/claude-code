-- ─── Cutover step 4: per-user composite unique keys (audit H6) ────────────────
-- APPLY AT CUTOVER ONLY, AFTER 029 (NOT NULL). External ids are unique only
-- within one creator's own accounts — two creators can DM the same person or
-- post on the same day — so the pilot's global unique constraints must become
-- per-user composites, and the code onConflict targets flip to match (keyed on
-- multiUserEnabled() in lib/db/conflictTargets.ts).
--
-- NOTE: composite uniques do NOT dedupe rows with a NULL user_id (Postgres
-- treats NULLs as distinct), which is why 029 (NOT NULL) must run first.

-- conversations: (platform, external_thread_id) → (user_id, platform, external_thread_id)
alter table conversations drop constraint if exists conversations_platform_external_thread_id_key;
alter table conversations
  add constraint conversations_user_platform_thread_key
  unique (user_id, platform, external_thread_id);

-- messages: unique(external_message_id) index → (user_id, external_message_id)
drop index if exists messages_external_message_id_key;
create unique index if not exists messages_user_external_message_id_key
  on messages (user_id, external_message_id);

-- follower_snapshots: (platform, snapshot_date) → (user_id, platform, snapshot_date)
alter table follower_snapshots drop constraint if exists follower_snapshots_platform_snapshot_date_key;
alter table follower_snapshots
  add constraint follower_snapshots_user_platform_date_key
  unique (user_id, platform, snapshot_date);

-- content_metrics: (platform, external_post_id) → (user_id, platform, external_post_id)
alter table content_metrics drop constraint if exists content_metrics_platform_external_post_id_key;
alter table content_metrics
  add constraint content_metrics_user_platform_post_key
  unique (user_id, platform, external_post_id);

-- platform_connections stays global unique(platform, account_id): it holds only
-- the owner's own direct-OAuth tokens (owner-only route), so no per-user split
-- is needed there.
