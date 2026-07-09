-- Rich client profiles: everything needed to give a client a top-notch,
-- personalized service, plus a home for free-form context the AI can read.
alter table clients
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists job_title text,
  add column if not exists location text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists goals text,
  add column if not exists preferences text,
  add column if not exists important_dates text,
  add column if not exists ai_context text;

comment on column clients.goals is 'What the client is trying to achieve — used by the AI to tailor replies';
comment on column clients.preferences is 'Communication style, likes/dislikes, anything that shapes how to talk to them';
comment on column clients.important_dates is 'Free text: birthdays, renewal dates, milestones etc.';
comment on column clients.ai_context is 'Free-form notes the creator writes specifically to brief the AI assistant on this client';
