# Meta App Review — Submission Pack

This is the paste-ready pack for taking the Corvelle Meta app from Development
Mode (Standard Access) to **Live / Advanced Access**, which is what currently
blocks Facebook **outbound** replies and Instagram **inbound** message content.

Everything below is grounded in what the app actually requests and does — see
the scope sources in `app/api/meta/connect/route.ts` and
`app/api/instagram/connect/route.ts`.

---

## 0. Why this is needed (the root cause)

In Development Mode with Standard Access, Meta only delivers messaging events
for **app admins/testers**, and gates message *content* and the **Send API**.
That is exactly the symptom set we see:

- Facebook inbound works (we're a tester) but **outbound reply → OAuthException**
- Instagram delivers only peripheral events (`message_edit`), never real
  message content
- Contact-name profile lookups return just `{ "id": … }`

This is not a code bug — third-party inbox tools (ManyChat, Respond.io,
Chatfuel) all operate as Meta Tech Providers with these same permissions at
Advanced Access. The fix is the review path below.

---

## 1. Prerequisite — Business Verification

**Where:** business.facebook.com → Business Settings → Security Center →
Business Verification.

Have ready:
- Legal business name + address + phone (must match a public record / utility
  bill / registration doc)
- Business website: `https://influencer-pa.vercel.app`
- A verification document (business registration, or utility bill for a sole
  trader)

Business Verification must be **approved** before Advanced Access is granted.
It is the long pole — start it first; it can take days.

---

## 2. Permissions to request (Advanced Access)

| Permission | Product | Why the app needs it |
|---|---|---|
| `pages_messaging` | Messenger | Read inbound Page DMs and send the creator's replies from the unified inbox |
| `pages_show_list` | Facebook Login | List the Pages the creator manages so they can pick one to connect |
| `pages_read_engagement` | Facebook Login | Read Page metadata/engagement for the connected Page |
| `pages_manage_posts` | Facebook Login | Publish scheduled posts to the Page from the post portal |
| `instagram_business_basic` | Instagram | Identify the connected IG professional account |
| `instagram_business_manage_messages` | Instagram | Read inbound IG DMs and send replies from the inbox |
| `instagram_business_manage_comments` | Instagram | Surface/reply to comments alongside DMs |

App settings to confirm before submitting:
- **App Mode:** will flip to **Live** once approved
- **Business use** selected (not "Consumer")
- Privacy Policy URL + Data Deletion instructions URL set in App Settings →
  Basic (see §5)

---

## 3. Use-case text (paste into each permission's "How will you use this?")

### pages_messaging
> Corvelle is a personal message-management tool used by a single content
> creator to manage their own Facebook Page. When a follower sends the creator's
> Page a direct message, Corvelle displays it in a unified inbox. The creator
> reads the message and sends their own reply through Corvelle. We use
> `pages_messaging` solely to receive inbound Page messages via webhook and to
> send the creator's manually-composed or reviewed replies within the standard
> 24-hour messaging window. We do not send bulk, automated, or promotional
> messages.

### instagram_business_manage_messages
> The creator connects their own Instagram professional account. Corvelle
> receives inbound Instagram direct messages via webhook and shows them in the
> same unified inbox as Facebook and email. The creator replies to their
> followers directly from Corvelle. We use this permission only to read the
> creator's own account's inbound DMs and to send replies the creator has
> composed or approved. No automated mass-messaging.

### pages_show_list / pages_read_engagement
> During onboarding the creator authorizes their Facebook Page. We use
> `pages_show_list` to present the list of Pages they manage so they can select
> the correct one, and `pages_read_engagement` to read that Page's basic
> metadata for display in the inbox and KPI dashboard.

### pages_manage_posts
> Corvelle includes a post portal where the creator schedules content. On the
> scheduled time we publish the creator's own post to their connected Page. We
> use `pages_manage_posts` only to publish content the creator has authored and
> scheduled.

### instagram_business_basic / instagram_business_manage_comments
> `instagram_business_basic` identifies the creator's connected professional
> account. `instagram_business_manage_comments` lets the creator view and reply
> to comments on their own posts from within Corvelle, alongside their DMs.

---

## 4. Screencast scripts (Meta requires a video per messaging permission)

Record at `https://influencer-pa.vercel.app` while **logged in as the creator**.
Show the full flow end to end; narrate what each step does. Keep each 60–120s.

### Video A — Facebook Login + Page connect (covers pages_show_list / read_engagement / manage_posts)
1. Start at `/auth/login`, log in with the magic link.
2. Go to `/onboarding`. Click **Connect** on the Facebook card.
3. Show the Meta OAuth dialog → the list of Pages → select the Page → approve
   permissions.
4. Return to `/onboarding`; show the Facebook card now reads **Connected**.
5. (Optional) Go to the post portal, schedule a post to the Page to show
   `pages_manage_posts`.

### Video B — Facebook messaging round-trip (covers pages_messaging)
1. From a second phone/account, send a DM to the creator's Page.
2. Show it appear in `/inbox` in Corvelle.
3. Open the conversation, type a reply, send it.
4. Show the reply arriving back in Messenger on the phone.

### Video C — Instagram connect + messaging round-trip (covers instagram_* )
1. On `/onboarding`, connect the Instagram professional account (OAuth dialog →
   approve).
2. From a second account, DM the creator's IG account.
3. Show it appear in `/inbox`.
4. Reply from Corvelle; show it arrive back in Instagram.
5. (Optional) Show replying to a comment for `instagram_business_manage_comments`.

> **Chicken-and-egg note:** the FB/IG *reply* steps (Videos B & C) are exactly
> what's currently gated. Meta permits recording the review demo against the app
> in Development Mode with the reviewer/creator as a tester — the send works for
> app testers even before approval in most cases. If a send still fails on
> camera, record the inbound + compose flow and state in the notes that outbound
> is pending the very Advanced Access being requested.

---

## 5. Data & privacy URLs Meta will check

These pages **already exist and are live** — no code needed, just register the
URLs in App Settings → Basic before submitting:
- **Privacy Policy URL:** `https://influencer-pa.vercel.app/privacy` ✅ live
- **Terms of Service URL:** `https://influencer-pa.vercel.app/terms` ✅ live
- **Data Deletion (instructions):** `https://influencer-pa.vercel.app/data-deletion` ✅ live

> The data-deletion page currently documents **manual** deletion (revoke via
> the platform, or email request). That satisfies Meta's "Data Deletion
> Instructions URL" requirement. If a reviewer specifically demands an automated
> **Data Deletion Callback** endpoint instead, flag it and I'll build the
> callback route — but the instructions URL is normally sufficient for a
> single-user app.

---

## 6. Submission order (checklist)

1. [ ] Start Business Verification (§1) — do this first, it's slow
2. [ ] Add Privacy Policy + Data Deletion pages (dev task — see §5)
3. [ ] Fill use-case text for each permission (§3)
4. [ ] Record screencasts A/B/C (§4)
5. [ ] Submit for App Review
6. [ ] On approval: flip app to **Live**, confirm Advanced Access on each
       permission
7. [ ] Re-test FB outbound reply + IG inbound content — both should now work
