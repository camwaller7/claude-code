-- Cache the AI-generated deal preview so it isn't regenerated (and re-charged
-- against the user's AI usage) every time the deal detail view is opened.
alter table deals add column if not exists ai_summary text;
alter table deals add column if not exists ai_summary_at timestamptz;
