# Corvelle — Full Software Audit

Senior-engineer audit across security/privacy, data model, backend/billing, and
frontend/build health. Conducted as pre-public-trial hardening, with emphasis on
safety of personal data (DMs, emails, brand-deal & client PII).

**Context that shapes severity:** multi-tenancy is gated by `MULTIUSER_ENABLED`
(currently off — the live app is a single-owner pilot). Many findings are latent
today but become live breaches the instant the flag is flipped. They are rated
at the severity they carry once multi-user is on, because the code ships ahead of
that switch.

Legend — Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.
Category: `RISK` · `DELETE` · `CLEANUP` · `MISSING`.
Status: ✅ fixed this pass · 🚩 flagged for sign-off · ⏳ planned.

---

## Executive summary

The core engine (Zernio messaging, Stripe billing, tier model routing, chat tool
loop, token encryption, most signature verification, the media proxy) is
fundamentally sound. The risk is concentrated in **multi-tenant isolation** and
**a few fail-open safety defaults**:

- **Cross-tenant IDOR** on the `[id]` conversation routes that use the admin
  client without user scoping — worst case, a user drives *another creator's*
  Instagram/Facebook account to send a DM. (C1, C2)
- **Plan gating is not enforced on API routes** — only on page navigation — so an
  unpaid user can call the AI/data endpoints directly. (C3)
- **Fail-open defaults**: the owner gate allows everyone when `OWNER_EMAIL` is
  unset; the Zernio webhook accepts unverified payloads. (C4, H1)
- **Billing integrity gaps**: caps are check-then-act (burst-bypassable), Stripe
  top-up credits can double-grant on webhook redelivery, and a missing price
  metadata key silently downgrades a paying customer. (H2, H3, H4)
- **Systemic tenancy gaps in the data layer**: `is_app_owner()` RLS bypass,
  nullable `user_id`, global unique constraints that overwrite across tenants,
  and several webhook/sync writers that never stamp `user_id`. (D1–D6)
- **Missing safety nets**: zero automated tests, no error boundaries, no startup
  env validation, no data-subject (delete/export) endpoints, 10 high-severity
  dependency CVEs.

---

## 🔴 CRITICAL

### C1 — Cross-tenant IDOR: conversation PATCH/DELETE/GET via admin client
`app/api/conversations/[id]/route.ts` — PATCH/DELETE/GET use `adminSupabase`
(bypasses RLS) filtered only by `id`. In multi-user, any user can read, re-status,
or delete another tenant's conversation (messages cascade-delete). **Status: ✅**
— add `user_id` scoping (no-op in pilot, correct in multi-user).

### C2 — Cross-tenant IDOR + send-as-another-tenant: reply route
`app/api/conversations/[id]/reply/route.ts` — loads the conversation by `id` with
no user scoping, then sends the DM through the conversation **owner's** connected
account. A user could send messages from a victim's real Instagram/Facebook
account by enumerating conversation ids. **Status: ✅** — verify ownership before
sending.

### C3 — Plan gating not enforced on API routes
`lib/auth/requireApiAuth.ts` never checks `hasActivePlan`; only the page guard
`requireAuth` does. Unpaid/canceled users can POST to `/api/chat`,
`/api/deals/[id]/summary`, `/api/conversations/[id]/reply` directly and get full
AI + data access. **Status: ✅** — enforce `hasActivePlan` in `requireApiAuth`
for multi-user non-owner callers.

### C4 — Owner gate fails OPEN when `OWNER_EMAIL` is unset
`lib/auth/isOwner.ts` — returns `true` for everyone when no owner email is
configured. With open magic-link signup, any member of the public who signs up
gets full owner access to all data in the pilot. **Status: 🚩** — must fail
closed, but flip requires confirming `OWNER_EMAIL` is set in production first (or
it locks out the owner too). See remediation.

### C5 — Zernio webhook accepts UNVERIFIED payloads
`app/api/webhooks/zernio/route.ts` — `verifyZernioSignature` returns `true` when
the secret is unset OR no known signature header is present. An attacker can
inject/spoof inbound messages, attribute them to any tenant via `account.id`, and
force AI triage spend. **Status: 🚩** — fail closed, but needs Zernio's exact
signature header confirmed so we don't break live inbound. See remediation.

### C6 — Zero automated tests
No test harness for an app handling personal data + billing. **Status: ⏳** —
stand up Vitest with webhook-signature, billing-cap, token-cipher, auth, and
tenant-isolation tests. See remediation.

---

## 🟠 HIGH

### H1 — `is_app_owner()` RLS bypass = permanent cross-tenant access
`021_multiuser_tenancy.sql` — every per-user policy is
`using (user_id = auth.uid() OR is_app_owner())`. The owner JWT can read/write
**every** tenant's rows via the REST API. **Status: 🚩** — remove the
`is_app_owner()` disjunct once backfill is verified (or gate behind an explicit
admin role).

### H2 — Caps are check-then-act (burst-bypassable)
`lib/billing/modelRouting.ts` reads `token_usage` counts that are only written
*after* the call. Concurrent requests all pass the same check → Starter blows
past 50/day, Pro past the Opus cap. **Status: 🚩** — needs an atomic
increment-and-check RPC (reservation), a non-trivial billing change.

### H3 — Stripe top-up credits double-granted on webhook redelivery
`app/api/webhooks/stripe/route.ts` — no event idempotency; `addCredits` is an
incrementing RPC, and a throw after it succeeds returns 500 → Stripe retries →
credits granted twice. **Status: ✅** — add a `stripe_processed_events` table and
no-op on duplicate `event.id`.

### H4 — Missing `tier` price metadata silently downgrades a paying customer
`app/api/webhooks/stripe/route.ts` `tierAndIntervalFromSub` defaults to `starter`
when `price.metadata.tier` is absent. **Status: ✅** — map tier from the price ID
(`lib/billing/prices.ts`) and log when unmappable instead of defaulting.

### H5 — `draft_reply` chat tool bypasses tier routing & cap counting
`app/api/chat/route.ts` — uses global settings model regardless of tier and logs
usage with no `userId`. **Status: ✅** — route through the active tier model and
attribute usage.

### H6 — Global unique constraints overwrite data across tenants
`follower_snapshots (platform, snapshot_date)` and
`content_metrics (platform, external_post_id)` (and the conversations/messages
external-id keys) are global. Two tenants collide; one overwrites the other on
upsert. **Status: 🚩** — make the unique keys composite with `user_id`; needs a
migration + `onConflict` updates.

### H7 — Meta/Gmail/X webhook & sync writers never stamp `user_id`
`app/api/webhooks/meta`, `app/api/gmail/sync`, `app/api/x/sync`,
`app/api/instagram/insights`, `app/api/webhooks/telegram` — inbound rows get
`user_id = NULL`, invisible under per-user reads. Also `resolveMetaContact` can
use another tenant's token. **Status: 🚩** — tied to the legacy-path decision
below; stamp `user_id` or retire these paths.

### H8 — No error boundaries; unpaid-route hardening; env validation missing
No `error.tsx`/`global-error.tsx` anywhere; no startup validation that required
secrets exist (missing secrets fail silently, often fail-open). **Status:** error
boundaries ✅; env validation �Status 🚩 (a boot-throwing validator can break a
deploy — needs the required-var list agreed).

### H9 — Backfill silently no-ops if `app_owner` is empty
`021_multiuser_tenancy.sql` — if `app_owner` is empty or the email doesn't match
`auth.users`, all existing rows keep `user_id = NULL` and the migration reports
success. **Status: 🚩** — raise an exception when non-empty tables can't be
backfilled.

### H10 — Dependency CVEs (10 high)
`npm audit`: postcss (XSS/file-read), sharp (libvips CVEs), protobufjs (DoS).
Full fix needs `next@16.3.4`. **Status: 🚩** — deliberate Next bump + smoke test;
`protobufjs` fixable non-breaking now.

---

## 🟡 MEDIUM

- **M1 — audit-log & token-usage endpoints leak across tenants.** `app/api/audit-log`
  and `app/api/settings/token-usage` use the admin client unscoped. **✅** scope by user.
- **M2 — Credit consumption best-effort & swallowed.** `consumeCredits(...).catch(()=>{})`
  — a paid call can keep its credit if the RPC fails. **✅** log failures (atomic
  reservation is the fuller fix, tied to H2).
- **M3 — Zernio outbound reconciliation by body match is fragile.** Duplicate/ whitespace/
  delayed-echo edge cases. **🚩** reconcile on the Zernio message id returned at send.
- **M4 — Post publish lacks cross-run idempotency.** Double `publish.scheduled` events →
  duplicate social posts; no re-check after `sleepUntil`. **🚩** assert `status='scheduled'`
  after sleep + Inngest idempotency key.
- **M5 — No rate limiting on AI endpoints.** `checkAIBudget` is a global cap → one user can
  DoS the shared budget. **🚩** per-user/IP limits + per-user spend cap.
- **M6 — No account deletion / data export (DSR/GDPR gap).** **🚩** add authenticated
  delete-my-data + export before public launch.
- **M7 — Raw DB/provider error messages leaked to clients.** reply/chat/tools. **✅** generic
  messages + server-side detail.
- **M8 — Request bodies parsed without schema validation.** reply (no try/catch, empty body
  "sent"), chat messages. **✅** add zod validation on the highest-risk routes.
- **M9 — Meta data-deletion deletes across tenants by external id only.** **🚩** scope to the
  owning connection (tied to legacy-path decision).
- **M10 — audit_log `on delete cascade`** wipes the security record when a user is deleted.
  **🚩** change to `on delete set null` (migration).
- **M11 — Missing composite indexes** for `(user_id, status)`, `(conversation_id, sent_at)`,
  `(user_id, created_at)` on token_usage (quota checks). **🚩** add in a migration.
- **M12 — Dual connect paths** (legacy Meta OAuth vs Zernio) both wired in the UI.
  **🚩** decide one against PLAN.md, delete the other.
- **M13 — `message.user_id` not guaranteed to match its conversation's owner.** **🚩** derive
  from the conversation.

---

## 🟢 LOW / CLEANUP

- **L1 — Delete `app/api/debug/webhook-status/route.ts`** (dead debug endpoint). **✅**
- **L2 — Remove "TEMPORARY DIAGNOSTIC" logging** in the reply route (logs message bodies). **✅**
- **L3 — Remove unused imports** (`AIChat.tsx` MessageCircle/Sparkles; gmail sync `subject`). **✅**
- **L4 — Remove 3 unused Radix deps** (dropdown-menu, separator, toast — toasts use sonner). **✅**
- **L5 — Fix 11 lint errors** (empty interfaces, `window.location.href`→`.assign`, LookSettings
  dataset mutation → effect, set-state-in-effect). **✅** the clear ones.
- **L6 — Move demo/seed SQL out of `supabase/migrations/`** — `demo_seed.sql`,
  `demo_seed_analytics.sql`, `clear_demo_data.sql` begin with unconditional deletes and could
  wipe production. **✅** move to `scripts/dev-only/`.
- **L7 — Deal-summary final update not re-scoped** (defense-in-depth). **✅**
- **L8 — Global `settings` row shared across tenants** (per-user settings is a multi-user
  blocker). **🚩**
- **L9 — Health endpoint leaks activity timing** (`lastMessageReceivedMinutesAgo`). **✅** drop it.
- **L10 — Standardize error status codes** (AI routes return 200 with `{error}`). **⏳**
- **L11 — tsconfig hardening** (`noUncheckedIndexedAccess`, `noUnusedLocals`). **⏳**
- **L12 — Loading/empty states** missing on deals/clients/settings/billing/post-portal. **⏳**

---

## Verified SOUND (no action)

- Stripe (`constructEvent`), Meta (`x-hub-signature-256` + verify-token via
  `timingSafeEqual`), and Telegram (per-bot secret via `timingSafeEqual`) webhook
  signature verification.
- Media proxy allowlist (`https:` + `zernio.com`/`.zernio.com` via parsed URL,
  auth-gated) — no SSRF.
- Token encryption (AES-256-GCM, throws on missing/short key).
- `setup-webhook` no longer echoes the secret.
- Collection list routes + `[id]` routes for deals/clients/messages/posts use the
  RLS-enforced request client and scope correctly.
- Chat tool loop scopes every tool by `chatUserId`.
- `requireApiAuth`/`requireAuth` verify JWTs via `getUser()` and support the
  internal-secret path via `timingSafeEqual`.
- `onConflict` targets all have backing unique constraints (though several are
  global — see H6).

---

## Remediation plan

**Applied this pass (safe — no-op in pilot / additive):** C1, C2, C3, H3, H4,
H5, M1, M2, M7, M8, L1, L2, L3, L4, L5, L6, L7, L9, plus error boundaries.

**Flagged for your sign-off (need a decision, env confirmation, or a schema
change that must be applied carefully):**
- **C4 / C5** (fail-closed owner gate & webhook) — confirm `OWNER_EMAIL` and
  `ZERNIO_WEBHOOK_SECRET` are set in production, and confirm Zernio's exact
  signature header, then flip to fail-closed.
- **H1** (remove `is_app_owner()` RLS bypass) — after backfill verified.
- **H2 / M2** (atomic cap reservation) — billing-logic change.
- **H6 / M10 / M11 / H9** (composite unique keys, audit_log cascade, indexes,
  backfill guard) — a new migration.
- **H7 / M9 / M12** (legacy Meta/Gmail/X path) — product decision vs PLAN.md.
- **H10** (Next.js bump for CVEs) — deliberate upgrade + smoke test.
- **C6** (test harness) — set up Vitest + the priority tests.
- **M5 / M6** (rate limiting, account deletion/export) — pre-public-launch.
- **H8 env validation, L8 per-user settings, L10–L12** — follow-ups.
</content>
