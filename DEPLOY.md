# Deployment Guide

Everything runs on Vercel + Supabase. This guide goes from zero to live.

---

## 1. Supabase — production database

1. Go to [supabase.com](https://supabase.com) and create a new project (or use an existing one).
2. In the SQL editor, run the three migrations **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_platform_connections_unique.sql`
   - `supabase/migrations/003_add_sync_columns.sql`
3. From **Project Settings → API**, copy:
   - `NEXT_PUBLIC_SUPABASE_URL` → the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the `anon` `public` key
   - `SUPABASE_SERVICE_ROLE_KEY` → the `service_role` key (keep secret)
4. From **Authentication → URL Configuration**, set:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: add `https://your-app.vercel.app/auth/callback`

---

## 2. Vercel — deploy the app

1. Go to [vercel.com](https://vercel.com), import the `camwaller7/claude-code` repo.
2. Set the **Production Branch** to `claude/magical-hopper-fmpbje` (or merge to `main` first).
3. Add all environment variables from `.env.example` — see the table below.
4. Deploy. Note your production URL (e.g. `https://your-app.vercel.app`).
5. Go back and set `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app`, then **redeploy**.

### Environment variables cheat sheet

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `META_APP_ID` | Meta for Developers → your app → Settings → Basic |
| `META_APP_SECRET` | Meta for Developers → your app → Settings → Basic |
| `META_WEBHOOK_VERIFY_TOKEN` | Any random string you choose (e.g. `openssl rand -hex 16`) |
| `X_CLIENT_ID` | developer.twitter.com → your app → Keys and Tokens → OAuth 2.0 |
| `X_CLIENT_SECRET` | developer.twitter.com → your app → Keys and Tokens → OAuth 2.0 |
| `GMAIL_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 |
| `GMAIL_CLIENT_SECRET` | Same as above |
| `INNGEST_EVENT_KEY` | [app.inngest.com](https://app.inngest.com) → your app → Manage → Event Keys |
| `INNGEST_SIGNING_KEY` | Inngest → your app → Manage → Signing Key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel production URL, no trailing slash |

---

## 3. Inngest — background jobs

1. Sign up at [app.inngest.com](https://app.inngest.com) and create an app.
2. Copy `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` into Vercel env vars.
3. In the Inngest dashboard, add your production URL as a sync endpoint:
   `https://your-app.vercel.app/api/inngest`
4. Click **Sync** — Inngest will discover `syncInboxes` (15-min cron) and `publishPost`.

---

## 4. Meta — webhook subscription

After deploying, you need Meta to push DMs to your app in real time.

1. Go to [developers.facebook.com](https://developers.facebook.com) → your app → **Webhooks**.
2. Subscribe to the **Instagram** product:
   - Callback URL: `https://your-app.vercel.app/api/webhooks/meta`
   - Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
   - Fields: `messages`, `messaging_postbacks`
3. Do the same for the **Messenger** product (same callback URL and verify token).
4. Make sure your Meta app is set to **Live** mode (not Development) — otherwise only test users receive webhooks.

---

## 5. Platform OAuth — register redirect URIs

Each platform requires the callback URL whitelisted before OAuth will work.

### Meta (Instagram + Facebook + Threads)
- App Dashboard → Facebook Login → Settings → Valid OAuth Redirect URIs:
  `https://your-app.vercel.app/api/meta/callback`

### X (Twitter)
- developer.twitter.com → your app → Settings → User authentication settings:
  - Callback URI: `https://your-app.vercel.app/api/x/callback`
  - Website URL: `https://your-app.vercel.app`

### Gmail
- Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client:
  - Authorised redirect URI: `https://your-app.vercel.app/api/gmail/callback`

### Threads
- Same Meta app as Instagram — add `https://your-app.vercel.app/api/threads/callback`
  to the valid redirect URIs in the Threads product settings.

---

## 6. First login

1. Visit `https://your-app.vercel.app/auth/login`
2. Enter `cambswaller7@gmail.com` — Supabase sends a magic link
3. Click the link → you're in
4. Go to `/onboarding` and connect each platform one by one

---

## 7. Verify everything works

- [ ] `/onboarding` shows all platforms as Disconnected initially
- [ ] Clicking "Connect" for Meta → OAuth flow → redirects back → shows Connected
- [ ] Same for X and Gmail
- [ ] `/inbox` — trigger a manual sync: `POST /api/gmail/sync` (or wait 15 min for Inngest cron)
- [ ] `/deals` — "Add Deal" button opens dialog, deal appears in correct column
- [ ] `/post-portal` — create a draft post, "Publish now" button queues Inngest job
- [ ] Inngest dashboard shows function runs with no errors
