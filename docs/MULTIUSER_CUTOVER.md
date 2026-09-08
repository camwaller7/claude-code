# Multi-user cutover plan

The ordered, interdependent steps to run **before flipping `MULTIUSER_ENABLED=true`
for real trial users**. These are deliberately NOT auto-applied because they must
run in order, some depend on a product decision, and one (billing caps) is a
correctness-sensitive change. Everything here only affects the multi-user path —
the single-tenant pilot is unaffected until the flag flips.

## Status (implemented)

All code and migrations for the cutover are in the repo. Migrations split into
two groups:

- **Additive — safe to apply anytime** (the pilot keeps working; code falls back
  or fails open if they're absent):
  - `028_ayrshare_profiles` — per-user Ayrshare publishing profiles.
  - `032_daily_usage_reservation` — atomic daily-interaction cap (H2).
  - `033_per_user_settings` — per-user persona/theme (L8).
  - `034_rate_limits` — DB-backed API rate limiter (M5).
- **Cutover-only — apply IN ORDER at the moment `MULTIUSER_ENABLED` flips**, never
  to the live pilot (they enforce `user_id`, which pilot writes don't yet set):
  - `029_user_id_not_null` → `030_composite_unique_keys` → `031_remove_owner_rls_bypass`.

Publishing: Zernio has no publishing API, so the post portal publishes through
**Ayrshare** (`lib/platform/ayrshare.ts`) — each user links their own accounts
via Ayrshare's hosted SSO and posts run under their `profileKey`. The legacy
direct-Meta/X path remains as the owner's fallback and is now scoped to the
post's `user_id`. Direct-OAuth connect/callbacks are owner-only in multi-user and
stamp `user_id`; their legacy DM backfill was removed (Zernio owns messaging).

Required env for Ayrshare: `AYRSHARE_API_KEY` (Business plan), plus
`AYRSHARE_PRIVATE_KEY` (PEM) and `AYRSHARE_DOMAIN` for the hosted SSO link.

## Gating decision — legacy Meta/Gmail/X path (audit H7, M9, M12)

The app has **two** ways to connect accounts:
- **Zernio** (aggregator): `app/api/zernio/*`, used by `components/settings/ConnectAccounts.tsx`.
- **Direct OAuth** (legacy): `app/api/{meta,instagram,threads,gmail,x}/*`, used by
  `app/onboarding/page.tsx`.

The legacy webhook/sync writers (`app/api/webhooks/meta`, `app/api/gmail/sync`,
`app/api/x/sync`, `app/api/instagram/insights`, `app/api/webhooks/telegram`) **do
not stamp `user_id`**, so in multi-user they produce unowned rows.

**DECISION (made): retire direct OAuth in favour of Zernio.**

Retired so far (replaced by Zernio; created unowned rows): the inbound-DM / sync /
insights writers — `app/api/webhooks/meta`, `app/api/gmail/sync`, `app/api/x/sync`,
`app/api/instagram/insights` (deleted), and the Gmail/X polling + legacy insights
Inngest steps.

**Still present, intentionally:** the `connect`/`callback` OAuth routes
(`app/api/{meta,instagram,threads,gmail,x}/*/connect|callback`) and
`meta/{deauthorize,data-deletion}`. Reason: the **post portal still publishes via
direct platform tokens** stored by those callbacks in `platform_connections`.
They can only be removed after post-portal publishing is migrated to Zernio's
publishing API. Until then the onboarding direct-connect links stay.

*(Original decision framing kept for reference:)*
**Keep direct OAuth as a fallback, or retire it in favour of Zernio?**
- **Retire** → delete those routes + the onboarding direct-OAuth links; removes a
  large dual-maintenance surface (App Review, token refresh, 24h window) and makes
  H7/M9 moot. Recommended if Zernio is permanent.
- **Keep** → each legacy writer must be updated to resolve and stamp the owning
  `user_id` (mirror the Zernio webhook), and `resolveMetaContact` must be scoped
  to the owning connection (M9).

Everything below assumes this is decided first.

## Ordered steps

1. **Stamp `user_id` on every writer** (or delete the legacy ones per the decision).
   Confirm: Zernio webhook ✅, Zernio insights ✅; legacy Meta/Gmail/X ❌ (pending).

2. **Verify no unowned rows.** Run `select assert_all_rows_owned();` (added in
   migration 027). It RAISES if any per-user table still has `user_id IS NULL`.
   Fix backfill (see H9) until it passes.

3. **Make `user_id` NOT NULL** on every per-user table (new migration). Only after
   step 2 passes, or the migration fails.

4. **Composite unique keys (H6).** Replace the global unique constraints with
   per-user composites, and update the code `onConflict` targets to match:
   - `follower_snapshots`: `unique(user_id, platform, snapshot_date)` →
     `onConflict: 'user_id,platform,snapshot_date'`
   - `content_metrics`: `unique(user_id, platform, external_post_id)` →
     `onConflict: 'user_id,platform,external_post_id'`
   - Consider the same for `conversations(platform, external_thread_id)` and
     `messages(external_message_id)` if external ids can collide across tenants.
   NOTE: composite uniques with a NULL `user_id` do NOT dedupe (Postgres treats
   NULLs as distinct) — this is exactly why step 3 (NOT NULL) must come first.

5. **Remove the `is_app_owner()` RLS bypass (H1).** Once all rows are owned,
   change every per-user policy from
   `using (user_id = auth.uid() OR is_app_owner())` to `using (user_id = auth.uid())`
   (same for `with check`). Keep a separate explicit admin mechanism if you need
   cross-tenant support access — do not reuse the ordinary owner login.

6. **Atomic cap enforcement (H2).** Today `resolveModelForUser` reads historical
   `token_usage` counts that are written *after* the call, so concurrent requests
   can each pass the same check and burst past the daily / weekly-Opus caps.
   Recommended design:
   - Daily interaction cap: a `daily_usage(user_id, day, count)` table with an
     RPC that atomically `insert … on conflict … do update set count = count + 1
     where count < cap returning count` — a NULL return means "capped". Call it as
     the reservation *before* dispatching; the current token_usage logging stays
     for reporting.
   - Weekly Opus cap is cost-based (variable per call), so reserve a fixed
     estimate up front and reconcile after, or cap by call-count as an
     approximation. This one needs a short design pass.

7. **Per-user settings (L8).** The global `settings` row (`id=1`) is shared; move
   assistant persona/theme to a per-user row (keep LLM provider/model
   platform-controlled for cost).

8. **Rate limiting (M5) + account deletion/export (M6)** before public launch.

## Env preconditions for the fail-closed flips (C4, C5)

Before flipping the owner gate and Zernio webhook to fail-closed:
- `OWNER_EMAIL` set in production (else the owner locks themselves out).
- `ZERNIO_WEBHOOK_SECRET` set, and Zernio's exact signature header confirmed from
  their docs (else inbound messages break). Then remove the "accept unverified"
  branches in `lib/auth/isOwner.ts` and `app/api/webhooks/zernio/route.ts`.
