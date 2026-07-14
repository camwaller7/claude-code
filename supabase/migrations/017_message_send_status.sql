-- The reply-send route previously swallowed platform-send failures and always
-- reported success to the UI, so a rejected/expired-token/24h-window send
-- looked identical to a real one. Track actual delivery outcome per message.
alter table messages add column if not exists send_status text not null default 'sent';
alter table messages add column if not exists send_error text;

-- send_status: 'sent' (delivered to the platform), 'failed' (platform rejected
-- or errored — see send_error), 'local_only' (platform has no send API, e.g.
-- Threads/TikTok DMs don't exist — message is app-side record only).
