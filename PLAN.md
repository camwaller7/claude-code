# PLAN.md — Corvelle

The build spec referenced by `CLAUDE.md`. Read this before starting any new
feature, especially anything platform-integration-related — platform
constraints below are hard limits, not things to work around.

## What this is

A single-creator personal assistant web app (three-month pilot, one user — not
multi-tenant SaaS). It unifies messaging and email, assists with triage and
replies, and tracks the business side of being a creator.

Feature areas:
1. **Unified inbox** — Instagram, Facebook, and X DMs plus Gmail in one list
2. **AI triage + reply drafting** — categorize inbound messages and draft replies (creator approves before send)
3. **Brand-deal CRM** — pipeline for inbound brand partnerships
4. **Course-client tracker** — clients who bought the creator's course/products
5. **KPI dashboard** — follower/engagement metrics across platforms
6. **Post portal** — schedule + auto-publish content across IG, FB, X, Threads, TikTok

## Platform capability matrix (hard limits)

| Platform | Inbound DMs | Outbound DMs | Publishing | Notes |
|---|---|---|---|---|
| Instagram | ✅ (Business Login, `changes[]`) | ✅ | ✅ | Needs a Professional (Business/Creator) account; DM content gated behind Advanced Access |
| Facebook Page | ✅ (`messaging[]`) | ✅ | ✅ | Send API + Advanced Access gated; 24-hour reply window |
| X (Twitter) | ✅ | ✅ | ✅ | DM API requires a paid tier |
| Gmail | ✅ | ✅ | — | Google OAuth; clean, no Meta gating |
| Telegram | ✅ | ✅ | — | Un-gated bot API; bots can only message users who message first |
| Threads | ❌ **no DM API** | ❌ | ✅ | Publish-only by design — do not attempt DM/inbox features |
| TikTok | ❌ **no DM API** | ❌ | ✅ (via 3rd-party) | Publishing via a third-party scheduling provider |

**Flag to the user, never silently work around:**
- Sending outbound IG/FB messages outside the 24-hour window without an approved message tag
- Any request for TikTok/Threads DM/inbox features (no API exists)
- Anything that assumes multi-user public access (would need Meta App Review beyond the single test user)

## Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind + shadcn/ui
- Supabase (Postgres, auth via magic link, storage)
- Inngest for scheduled/background jobs (post publishing, periodic inbox sync, analytics)
- Anthropic Claude API for categorization + reply drafting
- **Deployed on Vercel** (migrated from Railway) at `https://influencer-pa.vercel.app`

## Data model (see `supabase/migrations/`)

- `platform_connections` — one row per connected account (platform, account_id, encrypted access/refresh tokens, expiry). Unique on `(platform, account_id)`.
- `conversations` — one per thread (platform, external_thread_id, contact_name/handle, category, status, priority, last_message_at). Unique on `(platform, external_thread_id)`.
- `messages` — inbound/outbound bodies + AI category/draft; FK to conversation `on delete cascade`.
- `deals` — brand-deal CRM records; optional FK to conversation `on delete set null`.
- `clients` — course/product clients; optional FK to conversation `on delete set null`.
- `posts` — scheduled/published content across platforms.

## API surface (`app/api/`, grouped by integration)

- `{meta,instagram,threads,x,gmail}/connect` + `/callback` — OAuth start/finish; all redirect URIs built from `NEXT_PUBLIC_APP_URL`
- `telegram/connect` — bot-token connect (registers webhook)
- `webhooks/meta`, `webhooks/telegram` — inbound message ingestion
- `{gmail,x,instagram}/sync`, `instagram/insights` — pulled by Inngest crons (internal-secret protected)
- `conversations/[id]` — PATCH (category/status), DELETE
- `conversations/[id]/reply` — outbound send (per-platform branch)
- `inngest` — Inngest serve endpoint

## Background jobs (`lib/inngest/functions.ts`)

- `sync-inboxes` — every 15 min (`inbox/sync.requested`)
- `sync-analytics` — daily cron (`analytics/sync.requested`)
- `publish-post` — event-triggered (`post/publish.scheduled`), uses `step.sleepUntil` for future publish times

## Conventions

- TS strict, no `any` unless unavoidable
- Credentials/tokens only in Supabase `platform_connections`, encrypted (AES-256-GCM), never hardcoded
- Use Inngest for anything deferred/retryable — never `setTimeout` (won't survive a serverless function ending)
- Small components, colocated per feature area under `app/`

## Current status (2026-07)

**Operational:** Facebook inbound, Telegram (full round-trip), chat delete +
manual categorize, Vercel + Inngest deployment.

**Blocked on Meta App Review** (see `docs/META_APP_REVIEW.md`): Facebook
outbound replies, Instagram inbound message content, FB contact-name lookup —
all gated by Development Mode / Standard Access. Unblocking requires Business
Verification → App Review → Advanced Access → Live mode.

**Not yet wired up for the trial:** Gmail connect (code ready, needs env +
Google redirect URI), X DMs (needs paid API tier).

## Build order

1. ✅ Auth + single-owner access control
2. ✅ Platform connections + OAuth flows
3. ✅ Inbox ingestion (webhooks) + unified list
4. ✅ AI triage + reply drafting
5. ✅ Deals / clients / KPI / post portal
6. ✅ Deploy (Vercel + Supabase + Inngest)
7. ⏳ Meta App Review to unlock FB/IG messaging at scale
8. ⏳ Gmail live for the trial
