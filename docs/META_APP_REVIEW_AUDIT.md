# Meta App Review — Full Readiness Audit

A deep audit of the Corvelle app against what Meta actually checks during App
Review, so the submission passes first time. Every finding is tagged
**BLOCKER** (will cause rejection / Platform-Terms violation), **RECOMMENDED**
(likely flag or hardening), or **OPTIONAL**, with the exact evidence and fix.

Companion docs: `META_APP_REVIEW.md` (submission steps + use-case text +
screencast scripts). Sources: two code audits + manual review, 2026-08.

---

## Executive summary

| # | Finding | Severity | State |
|---|---------|----------|-------|
| 1 | A Meta reviewer cannot log in (single-owner gate) | BLOCKER | ✅ code fix shipped (allowlist) + needs test account |
| 2 | `instagram_business_manage_comments` requested but no comment feature exists | BLOCKER | ✅ removed from scope + subscription |
| 3 | `pages_read_engagement` requested but no Page-engagement read exists | BLOCKER | ✅ removed from scope |
| 4 | No real data-deletion mechanism (instructions page only) | BLOCKER | ✅ callbacks built + needs dashboard registration |
| 5 | Message bodies + contact names written to server logs | BLOCKER | ✅ fixed (gated behind env flag) |
| 6 | No `appsecret_proof` on token-bearing Graph calls | RECOMMENDED | ✅ applied to messaging calls; OAuth-time calls pending |
| 7 | Instagram insights uses a scope not requested (`instagram_manage_insights`) | RECOMMENDED | ⏳ reconcile |
| 8 | OAuth state/PKCE cookies missing `secure` flag (IG/Threads/Gmail/X) | RECOMMENDED | ✅ fixed |
| 9 | Send path in messy debug state (browser-spoof UA, query-string token) | OPTIONAL | ⏳ clean up |
| 10 | Legacy plaintext pass-through in `decryptToken` | OPTIONAL | leave (back-compat) |
| — | Business Verification not confirmed started | BLOCKER (process) | browser/owner |

> **Update (this round):** findings 2, 3, 4, 5, 6, 8 addressed in code. The
> fast-path decision on 2 & 3 was to REMOVE the unused permissions (reversible;
> re-add with a real feature in a later review round). Remaining: register the
> data-deletion + deauthorize callback URLs in the dashboard (browser),
> reconcile the insights scope (7), and the optional cleanups.

Solid and confirmed working: `pages_messaging`, `pages_show_list`,
`pages_manage_posts`, `instagram_business_basic`,
`instagram_business_manage_messages` all have genuine code behind them; token
encryption (AES-256-GCM) and webhook signature verification are correctly
implemented and enforced.

---

## BLOCKERS

### 1. Reviewer cannot access the app — ✅ code shipped, needs a test account
The app hard-gates every page/route to `OWNER_EMAIL` (`lib/auth/isOwner.ts`,
`lib/auth/requireAuth.ts`, `lib/auth/requireApiAuth.ts`) — any other email is
signed out to `/auth/login?error=forbidden`. Meta's #1 messaging-permission
rejection reason is "we could not test the feature."

**Fixed:** `OWNER_EMAIL` now accepts a comma-separated allowlist, so a dedicated
Meta-reviewer test account can be granted access for the review without sharing
the creator's login.

**Still required (browser/owner):**
- Create a Supabase user for a reviewer test email (or a Meta test user).
- Add that email to `OWNER_EMAIL` in Vercel (e.g. `you@…,reviewer@…`) for the
  review window; remove it after approval.
- Provide those credentials + step-by-step test instructions in the submission.

### 2. `instagram_business_manage_comments` — requested but unused (auto-reject)
The IG webhook subscribes to `comments` (`app/api/instagram/callback/route.ts`
~L108) but the handler processes only `messages` and drops comment events. No
code reads (`GET /{media}/comments`) or replies to comments.
**Decision needed — fastest path: REMOVE the permission now** (drop it from the
IG scope string + the dashboard use case) and add it in a later review round if
a comment feature is built. Alternative: build a comment view/reply feature
before submitting (more scope, slower).

### 3. `pages_read_engagement` — no real usage (reject risk)
No Facebook Page insights/engagement/metadata read exists (only Instagram has an
insights sync). Reviewers expect a genuine read behind this scope.
**Decision needed — REMOVE now** (fast path), or **BUILD** a small Facebook Page
insights read to feed the KPI dashboard (strengthens the app; slightly slower).

### 4. No data-deletion mechanism — build required
`app/data-deletion/page.tsx` is instructions only. There is no route that
parses Meta's `signed_request` deauthorize/data-deletion callback and no code
that deletes `platform_connections` / `conversations` / `messages`. The
instructions URL may satisfy the letter of review, but the Platform-Terms
deletion obligation has no executable path.
**Fix (planned):** add `POST /api/meta/data-deletion` and
`POST /api/meta/deauthorize` that verify `signed_request` (HMAC with app
secret), delete the affected user's stored data, and return the required
`{ url, confirmation_code }` JSON. Register those URLs in App Settings → Basic.

### 5. PII in server logs — ✅ fixed
`[meta-webhook-debug]` logged the entire raw webhook body (message text) and the
raw Graph profile response (contact name/username); `[reply-debug]` logged the
outbound message body. **Fixed:** all such lines now route through
`lib/log/debug.ts` (`metaDebug`), which is silent unless `META_DEBUG_LOGGING=true`.
The send-failure path keeps a non-PII operational error line (status + error
code + fbtrace) for production.

---

## RECOMMENDED

### 6. `appsecret_proof` missing — build helper + apply
No token-bearing Graph call sends `appsecret_proof` (HMAC-SHA256 of the token
with the app secret). If the app's "Require app secret proof for server API
calls" setting is on (Meta increasingly defaults this), the send API, profile
lookup, `/me/accounts`, conversations backfill, and token refresh calls all
fail. **Fix (planned):** add a helper that computes the proof with the correct
secret per platform (FB → `META_APP_SECRET`, IG → `INSTAGRAM_APP_SECRET`) and
attach it to every token-bearing call.

### 7. Instagram insights scope mismatch
`app/api/instagram/insights/route.ts` reads per-media `/insights`, which
typically needs `instagram_manage_insights` — not in the requested IG scope
string (`instagram_business_basic,instagram_business_manage_messages,
instagram_business_manage_comments`). Either add the scope (and justify it) or
drop the per-media insights read. Reconcile before submitting so the KPI
dashboard doesn't silently fail at runtime.

### 8. Secure cookie flag — ✅ fixed
IG/Threads/Gmail/X OAuth `state` cookies (and the X PKCE `code_verifier`) now
set `secure: process.env.NODE_ENV === 'production'`, matching the Meta connect
route.

---

## OPTIONAL / LOW

- **9. Send path debug state** — the Meta send uses a browser-spoof User-Agent
  and query-string token as leftovers from debugging the Dev-Mode gate. Once
  Advanced Access lands and sends work, revert to a clean JSON POST with the
  token in the header.
- **10. `decryptToken` plaintext pass-through** — legacy tokens without the
  `v1:` prefix are returned as-is (back-compat). Low risk; re-encrypt on next
  write or leave.

---

## Confirmed COMPLIANT (no action)

- **Token storage:** real AES-256-GCM with random IV + auth tag + versioned
  key (`lib/crypto/tokenCipher.ts`); genuine decrypt, not pass-through.
- **Webhook signature:** HMAC-SHA256 over raw body with `timingSafeEqual`,
  rejects with 401 before processing (`app/api/webhooks/meta/route.ts`).
- **24-hour window:** enforced before send with an explicit failure
  (`app/api/conversations/[id]/reply/route.ts`); `messaging_type: RESPONSE` set
  for Facebook.
- **No hardcoded secrets:** all from `process.env`.
- **App icon** 1024×1024 + manifest present; privacy/terms/data-deletion pages
  live.

---

## Browser-side audit (cannot be verified from code — Meta dashboard)

These must be checked in the App Dashboard; see the paste-ready checklist that
accompanies this audit (App Basics, App Mode & Business Verification,
Permissions & access levels, Use Cases, Roles/Test Users, Webhooks, Data-Use
prompts, submission state). Key reconciliation: **item 12/13 (what's requested)
must match the code audit above (what's used)** — remove any requested
permission not backed by code (findings 2 & 3).

---

## Recommended submission order

1. Decide findings 2 & 3 (remove for fastest pass — recommended).
2. Ship remaining code fixes (data-deletion callback #4, appsecret_proof #6,
   insights scope #7).
3. Set up the reviewer test account (#1) + `OWNER_EMAIL` allowlist entry.
4. Run the browser dashboard audit; fix any dashboard gaps.
5. Start/confirm Business Verification (long pole).
6. Fill use-case text + record screencasts (`META_APP_REVIEW.md`).
7. Submit.
