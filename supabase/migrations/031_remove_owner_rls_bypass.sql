-- ─── Cutover step 5: remove the is_app_owner() RLS bypass (audit H1) ──────────
-- APPLY AT CUTOVER ONLY, after every row is owned (029). Migration 021 kept an
-- `OR is_app_owner()` clause on every per-user policy so the single-tenant pilot
-- kept working before the app stamped user_id. In multi-user that clause is a
-- cross-tenant hole: the owner login could read/write every user's rows through
-- direct (JWT) access. Once all rows are owned and the app scopes by user_id,
-- replace each policy with strict per-user isolation.
--
-- `settings` is intentionally excluded here — it is still a shared global row
-- until migration 032 makes it per-user, which sets its final policy directly.
-- If you need cross-tenant support access later, add a SEPARATE explicit admin
-- role/policy — do NOT reuse the ordinary owner login.

do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations', 'messages', 'deals', 'clients', 'posts',
    'platform_connections', 'token_usage', 'follower_snapshots',
    'content_metrics', 'audit_log', 'zernio_accounts'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || ' per user', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || ' per user', t
    );
  end loop;
end $$;

-- The zernio_accounts policy in 021 was named "zernio_accounts per user"; the
-- loop above recreates it by that exact name, so the old bypass version is
-- dropped and replaced.
