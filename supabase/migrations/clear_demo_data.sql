-- ============================================================
-- CLEAR DEMO DATA — run in Supabase SQL Editor when ready to
-- switch from testing to real accounts. IRREVERSIBLE.
--
-- This wipes every business record (inbox, deals, clients, posts,
-- analytics) but leaves your account, security setup and app
-- settings untouched:
--   - auth.users / app_owner       (your login)
--   - settings                     (AI model, assistant persona, theme)
--   - audit_log                    (security history — keep for the record)
--   - platform_connections         (already empty until you connect one)
-- ============================================================

delete from messages;
delete from conversations;
delete from deals;
delete from clients;
delete from posts;
delete from follower_snapshots;
delete from content_metrics;

-- Done. Your inbox, deals, clients, post portal and dashboard analytics
-- are now empty and ready for real, connected-account data.
