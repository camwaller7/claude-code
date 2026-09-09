-- ─── Stable conversation identity: participant_id ───────────────────────────
-- Zernio identifies the same DM thread by DIFFERENT ids depending on the source:
-- the inbox webhook delivers Zernio's internal conversation _id (a hex string),
-- while the REST list endpoint returns the platform's own conversation id (a
-- numeric string). Keying conversations on that id therefore created a duplicate
-- row when history was backfilled — the webhook thread and the backfilled thread
-- never matched.
--
-- The one identifier present on BOTH surfaces is the participant's platform id
-- (the IGSID / PSID): `sender.id` on the webhook, `participantId` on the REST
-- API. Store it and reconcile on it so a person's thread is always one row.
--
-- Additive/nullable: existing rows are unaffected until the webhook/backfill
-- populate it; nothing depends on it being present.

alter table conversations add column if not exists participant_id text;

-- Look up a thread by who it's with, scoped by platform. Not unique (older rows
-- have a null participant_id, and the pilot has no user_id column to compose in).
create index if not exists conversations_platform_participant_idx
  on conversations (platform, participant_id)
  where participant_id is not null;
