-- Store message attachments (images, videos, voice notes, shared posts) so the
-- inbox thread can render rich media, not just text. Shape: a JSON array of
-- { type, url, name? } entries as delivered by the Zernio webhook.
alter table messages add column if not exists attachments jsonb;
