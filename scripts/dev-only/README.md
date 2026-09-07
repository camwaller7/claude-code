# Dev-only SQL — DO NOT run against production

These scripts were moved out of `supabase/migrations/` because they are
destructive and unowned (written before multi-tenancy):

- `demo_seed.sql`, `demo_seed_analytics.sql` — begin with unconditional
  `delete from` on messages/conversations/deals/clients/posts/analytics, then
  insert demo rows with **no `user_id`**. Running either wipes real data and
  seeds rows invisible under per-user RLS.
- `clear_demo_data.sql` — a full data wipe.

They are kept only for local development. Never include them in a
`supabase db push` / production migration run.
