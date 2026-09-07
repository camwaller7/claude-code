# Pre-trial backlog

Polish and feature items to complete before opening the app to public trial
users. Ordered roughly by priority. Checked items are done.

## Inbox / messaging

- [x] **Back button in a conversation.** Clicking into a message had no way back
  to the inbox except a page refresh. Added a "Back to inbox" link on the
  conversation page (`app/inbox/[id]/page.tsx`).

- [x] **Sent reply appears immediately + no duplicate.** Replies sent from the
  app didn't show until refresh, and then showed twice (the app insert plus
  Zernio's `message.sent` echo). `ReplyBox` now calls `router.refresh()` after
  sending, and the Zernio webhook reconciles the echo with the pending app-sent
  row instead of inserting a second copy.

- [x] **Rich media in messages.** Attachments are stored on the message
  (`attachments` jsonb, migration 025) at webhook ingest and rendered by type in
  `MessageThread` (image/video/audio player, a card for a shared post).
  Zernio-hosted media is streamed through an authenticated proxy
  (`/api/media`) since it needs the API key; media-only messages no longer show
  an empty text bubble. NOTE: if IG/FB webhook attachment URLs turn out to need
  Zernio's per-message resolve endpoint rather than a directly-fetchable URL,
  the proxy will need to call that endpoint — verify against live media.

  *(original notes:)* Inbound and outbound images, videos, voice notes, and
  shared posts were not shown.
  Zernio delivers these as `attachments[]` on `message.received` / `message.sent`
  (each with `type`, `url`, and for IG/FB a `refreshUrl`/authenticated media
  endpoint — see the Zernio SDK `PostAnalytics`/attachment types). Work:
  - Store attachments on the `messages` row (new `attachments jsonb` column) at
    webhook ingest.
  - Render them in `components/inbox/MessageThread.tsx` by type (img/video/audio
    player; a card for a shared post).
  - IG/FB media URLs may need proxying through an authenticated route since they
    require the Zernio API key — add `app/api/media/[...]` that streams them.

## Deals

- [x] **Open a deal's conversation from the deals portal.** DealCard shows a
  "View messages" link to `/inbox/{conversation_id}` when the deal is linked to
  a conversation (also inside the deal detail dialog).

- [x] **Deal detail view: AI preview + notes.** Clicking a deal's title opens
  `DealDetailDialog` with an AI preview (POST /api/deals/[id]/summary — charged
  against AI usage via tier routing + credits, cached on the deal) and an
  editable notes section. Original spec:
  - An **AI-generated summary/preview** of the deal (drafted from the linked
    conversation + deal fields), which **consumes the user's AI credits/usage**
    (route it through the same tier model routing + `logTokenUsage`).
  - A **notes section** the user can edit and save (add a `notes`-style field or
    reuse `deals.notes`; PATCH endpoint on `app/api/deals/[id]`).
  - Consider caching the AI preview so it isn't regenerated (and re-charged) on
    every open.

## Dashboard

- [x] **Platform filter lists every linkable account.** The dashboard filter
  now always offers Instagram, Facebook, X, Gmail and Telegram (plus any other
  connected platform), instead of only platforms with detected data.

  *(original note:)* The dashboard platform filter previously showed only
  "All" and Instagram. It should include
  all accounts the user can link (Instagram, Facebook, X, Threads, TikTok,
  Gmail, Telegram) — at least all connected ones. Investigate
  `lib/platform/linked.ts` (`getLinkedPlatforms`): confirm it returns Facebook
  and the other connected platforms, and decide whether to show all *linkable*
  platforms or only *linked* ones. Note the earlier decision was "only linked
  accounts" — revisit with the product intent of previewing all supported
  platforms.

## Notes

- Several of these (rich media, deal AI preview) consume AI credits — make sure
  they respect the tier caps and top-up credits in `lib/billing`.
