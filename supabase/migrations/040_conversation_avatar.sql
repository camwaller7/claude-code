-- ─── Contact profile picture ────────────────────────────────────────────────
-- Zernio already gives us the sender's avatar — `sender.picture` on the inbox
-- webhook and `participantPicture` on the REST list endpoint — we just weren't
-- storing it. Persist it so the inbox and open-thread header can show the real
-- profile photo instead of a generic platform badge. Nullable; the UI falls back
-- to the platform label when it's absent or the URL has expired.
alter table conversations add column if not exists contact_avatar text;
