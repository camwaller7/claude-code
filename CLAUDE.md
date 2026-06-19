# CLAUDE.md

This file is read automatically by Claude Code at the start of every session in this project. Keep it short and accurate — it's the persistent context, not the full spec.

## Project

A single-creator personal assistant web app: unified inbox for Instagram/Facebook/X DMs plus Gmail, AI-assisted message triage and reply drafting, a brand-deal CRM pipeline, a course-client tracker, a KPI dashboard, and a post portal that schedules and auto-publishes content across Instagram, Facebook, X, Threads, and TikTok (TikTok via a third-party scheduling provider).

This is a three-month pilot for one creator. Build for one user, not multi-tenant SaaS, unless told otherwise. Full feature scope, platform constraints, data model, and build order live in `PLAN.md` — read that before starting any new feature, especially before touching anything platform-integration-related, since not every platform supports every feature (e.g., TikTok and Threads have no DM API at all; this is a hard platform limitation, not something to work around).

## Tech stack

- Next.js (App Router), TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, auth, storage)
- Inngest for scheduled/background jobs (used for the post-portal's "publish at a future time" mechanism and for periodic inbox sync)
- Anthropic Claude API for message categorization and reply drafting
- Deployed on Vercel

## Conventions

- TypeScript strict mode, no `any` unless genuinely unavoidable
- API routes under `app/api/`, grouped by integration (`app/api/instagram/`, `app/api/x/`, `app/api/gmail/`, `app/api/tiktok/`, etc.)
- All platform credentials and tokens stored in Supabase (per `platform_connections` table in PLAN.md), never hardcoded
- Inngest functions for anything that needs to run later or retry on failure — don't use `setTimeout` or in-process delays for scheduling, they won't survive a serverless function ending
- Keep components small and colocate UI for each feature area (inbox, deals, clients, KPIs, post portal) under its own folder in `app/`

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — lint
- (add `npm run test` once a test setup exists — none yet at project start)

## Things to flag to the user rather than silently work around

- Any request that would require sending outbound Instagram/Facebook messages outside the 24-hour reply window without an approved message tag — flag it, don't bypass it
- Any request to add TikTok or Threads DM/inbox features — there is no API for this; flag it as not currently possible rather than attempting a scraping workaround
- Any request to skip Meta's test-user limit (currently fine for one creator; would need real App Review to add more users) — flag before building anything that assumes multi-user public access
