-- ============================================================
-- DEMO SEED DATA — run this in Supabase SQL Editor
-- Creates realistic mock data so you can test every feature
-- without connecting real social media accounts
-- ============================================================

-- Clear existing demo data (safe to re-run)
delete from messages;
delete from conversations;
delete from deals;
delete from clients;
delete from posts;

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================

-- 1. Instagram — Brand inquiry (high priority)
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('instagram', 'demo_ig_001', 'Sarah Mitchell', '@sarahmitchell', 'brand_deal', 'needs_reply', 1, now() - interval '2 hours')
  returning id
)
insert into messages (conversation_id, direction, body, ai_category, ai_draft_reply, sent_at)
select id,
  'inbound',
  'Hi! I''m the marketing manager at Glow Skincare. We''ve been following your content and would love to discuss a paid partnership for our new vitamin C serum launch. Our budget is $3,000–$5,000 for a 3-post deal. Are you available for a quick call this week?',
  'brand_deal',
  'Hi Sarah! Thanks so much for reaching out — I''d love to hear more about the Glow Skincare partnership. A 3-post deal sounds great. I''m available Thursday or Friday this week for a call. What time works best for you?',
  now() - interval '2 hours'
from c;

-- 2. Instagram — Follow-up on collab
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('instagram', 'demo_ig_002', 'Jake Torres', '@jaketorres.fit', 'brand_deal', 'needs_reply', 0, now() - interval '5 hours')
  returning id
)
insert into messages (conversation_id, direction, body, ai_category, ai_draft_reply, sent_at)
select id, 'inbound', 'Hey! Love your fitness content. Would you be down for a collab reel? I think our audiences would overlap really well 🔥', 'brand_deal', 'Hey Jake! Your content is great too — a collab reel sounds fun! What did you have in mind? Happy to brainstorm some ideas together.', now() - interval '5 hours'
from c;

-- 3. Facebook — Course question
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('facebook', 'demo_fb_001', 'Emma Rodriguez', 'emma.rodriguez.92', 'client', 'needs_reply', 0, now() - interval '1 day')
  returning id
)
insert into messages (conversation_id, direction, body, ai_category, ai_draft_reply, sent_at)
select id, 'inbound', 'Hi! I just purchased your content creator course. Is there a community group I can join? Also, when does module 3 drop?', 'client', 'Hi Emma! Welcome to the course — so excited to have you! Yes, the community group link is in the welcome email. Module 3 drops this Friday. Let me know if you have any questions!', now() - interval '1 day'
from c;

-- 4. X (Twitter) — Brand deal reply chain
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('x', 'demo_x_001', 'FitFuel Supplements', '@fitfuelhq', 'brand_deal', 'replied', 1, now() - interval '3 hours')
  returning id
)
insert into messages (conversation_id, direction, body, sent_at)
select id, dir, body, ts from (
  values
    ('inbound'::text,  'Hey! We''d love to send you our new pre-workout to review. Paid partnership — $1,500 for one post + story. Interested?', (now() - interval '2 days')),
    ('outbound'::text, 'Sounds great! I''d love to try FitFuel. Can you send over a brief so I can review the requirements?',               (now() - interval '1 day')),
    ('inbound'::text,  'Absolutely! Brief is on its way. We''d need the post live by the 30th. Let us know if the timeline works!',       (now() - interval '3 hours'))
) as v(dir, body, ts)
cross join c;

-- 5. Gmail — Serious brand deal negotiation
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('gmail', 'demo_gmail_001', 'Priya Kapoor', 'priya@luxelifestyle.com', 'brand_deal', 'needs_reply', 1, now() - interval '30 minutes')
  returning id
)
insert into messages (conversation_id, direction, body, sent_at)
select id, 'inbound',
  'Hi there,

I''m reaching out from LuxeLifestyle — a premium travel and lifestyle brand. We''ve been following your Instagram and YouTube content for months and think you''d be a perfect fit for our Q3 ambassador campaign.

We''re proposing a 3-month ambassador deal including:
- 2 Instagram posts per month
- 4 stories per month
- 1 YouTube integration

Budget: $12,000 total + complimentary hotel stays at our partner properties.

Would love to set up a discovery call. Are you free next week?

Best,
Priya Kapoor
Partnerships Manager, LuxeLifestyle',
  now() - interval '30 minutes'
from c;

-- 6. Instagram — Simple fan message (low priority)
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('instagram', 'demo_ig_003', 'Mia Chen', '@mia.creates', 'fan', 'replied', 0, now() - interval '2 days')
  returning id
)
insert into messages (conversation_id, direction, body, sent_at)
select id, dir, body, ts from (
  values
    ('inbound'::text,  'Your last reel was SO good! How long does it take you to edit one of those?',                                    (now() - interval '2 days')),
    ('outbound'::text, 'Thank you so much!! Usually about 3–4 hours for a good one 😊 The transitions take forever haha',               (now() - interval '1 day'))
) as v(dir, body, ts)
cross join c;

-- 7. Gmail — Spam/irrelevant
with c as (
  insert into conversations (platform, external_thread_id, contact_name, contact_handle, category, status, priority, last_message_at)
  values ('gmail', 'demo_gmail_002', 'No Reply', 'noreply@randompromo.com', 'spam', 'replied', 0, now() - interval '3 days')
  returning id
)
insert into messages (conversation_id, direction, body, sent_at)
select id, 'inbound', 'Congratulations! You have been selected to receive a free iPhone 15. Click here to claim your prize...', now() - interval '3 days'
from c;

-- ============================================================
-- DEALS (CRM Pipeline)
-- ============================================================

insert into deals (brand_name, contact_name, status, deal_value, currency, notes, created_at) values
  ('Glow Skincare',        'Sarah Mitchell',  'negotiating', 4000,  'USD', '3-post deal for vitamin C serum launch. Call scheduled for Thursday.',   now() - interval '2 hours'),
  ('LuxeLifestyle',        'Priya Kapoor',    'inquiry',     12000, 'USD', '3-month ambassador deal. Q3 campaign. Includes hotel stays.',             now() - interval '30 minutes'),
  ('FitFuel Supplements',  'Marketing Team',  'negotiating', 1500,  'USD', '1 post + 1 story. Deadline 30th. Brief received.',                        now() - interval '3 hours'),
  ('Bloom Coffee Co.',     'David Park',      'contracted',  2500,  'USD', 'Completed 2 reels + 3 stories. Awaiting payment.',                        now() - interval '1 week'),
  ('AirEase Travel',       'Nina Walsh',      'paid',        8000,  'USD', 'Q2 campaign fully paid. 4 posts over 6 weeks. Great partnership.',        now() - interval '3 weeks'),
  ('TechWear UK',          'James Liu',       'lost',        3000,  'USD', 'They went with another creator. Follow up in Q4.',                        now() - interval '1 month');

-- ============================================================
-- CLIENTS (Course / Product Buyers)
-- ============================================================

-- Emma is linked to her existing Facebook conversation (demo_fb_001) so her
-- client page shows the real message thread, matching how real client
-- records get created from an inbound message.
with c as (
  select id from conversations where external_thread_id = 'demo_fb_001'
)
insert into clients (conversation_id, name, handle, product_purchased, purchase_date, status, notes, created_at)
select c.id, 'Emma Rodriguez', 'emma.rodriguez.92', 'Content Creator Masterclass', '2026-06-01', 'active', 'Very engaged, asks great questions in community.', now() - interval '22 days'
from c;

insert into clients (name, handle, product_purchased, purchase_date, status, notes, created_at) values
  ('Tyler Brooks',    '@tylerbrooks',    'Content Creator Masterclass', '2026-06-03', 'active',    'Completed modules 1 and 2 already.',                      now() - interval '20 days'),
  ('Aisha Patel',     '@aishacreates',   'Content Creator Masterclass', '2026-06-05', 'active',    'Runs a food blog. Keen on the Instagram growth module.',   now() - interval '18 days'),
  ('Lucas Fernandez', '@lucas.lens',     '1:1 Coaching Session',        '2026-06-10', 'active',    'Had session last Tuesday. Follow up in 2 weeks.',          now() - interval '13 days'),
  ('Sophie Green',    '@sophieg',        'Content Creator Masterclass', '2026-05-15', 'churned',   'Finished the course! Left a great testimonial.',           now() - interval '38 days'),
  ('Marcus Webb',     '@marcuswebb',     '1:1 Coaching Session',        '2026-05-20', 'churned',   'Grew from 2k to 8k followers after coaching.',             now() - interval '33 days');

-- ============================================================
-- POSTS (Post Portal)
-- ============================================================

insert into posts (caption, hashtags, platforms, status, scheduled_at, published_at, created_at) values
  (
    'Morning routine that changed my life ✨ I used to wake up and immediately scroll — now I give myself 30 minutes before touching my phone and honestly? Game changer. Drop a 🌅 if you''re a morning person!',
    '#morningroutine #creatorlife #mindset #wellness',
    array['instagram', 'threads']::text[],
    'published',
    now() - interval '2 days',
    now() - interval '2 days',
    now() - interval '3 days'
  ),
  (
    'POV: You finally figured out the Instagram algorithm 👀 The secret isn''t posting more — it''s posting smarter. Save this for later, I''m dropping a full breakdown on Thursday.',
    '#instagramtips #contentcreator #socialmediatips #growyouraudience',
    array['instagram', 'facebook', 'x']::text[],
    'published',
    now() - interval '5 days',
    now() - interval '5 days',
    now() - interval '6 days'
  ),
  (
    'This brand deal almost didn''t happen — here''s what I learned about negotiating as a creator 💸 Thread below 👇',
    '#branddeals #creatortips #influencermarketing #negotiations',
    array['x', 'threads']::text[],
    'scheduled',
    now() + interval '1 day',
    null,
    now() - interval '1 hour'
  ),
  (
    'Behind the scenes of my most viral reel 🎬 From concept to 2.3M views — what actually worked and what I''d do differently.',
    '#behindthescenes #viralreel #contentcreator #reels',
    array['instagram', 'tiktok']::text[],
    'scheduled',
    now() + interval '3 days',
    null,
    now() - interval '2 hours'
  ),
  (
    'Honest review coming soon... 👀 Can you guess the brand? Comment your guess below!',
    '#honestreviews #comingsoon #brandpartner',
    array['instagram']::text[],
    'draft',
    null,
    null,
    now() - interval '30 minutes'
  ),
  (
    'The content creator toolkit I actually use every day — no fluff, just the tools that make a real difference. Link in bio for the full list!',
    '#creatortoolkit #contenttools #contentcreator #productivity',
    array['instagram', 'facebook', 'threads', 'x']::text[],
    'draft',
    null,
    null,
    now() - interval '10 minutes'
  );

-- ============================================================
-- Done! You should now see:
-- • 7 conversations across Instagram, Facebook, X and Gmail
-- • 6 deals across all pipeline stages
-- • 6 course/coaching clients
-- • 6 posts (2 published, 2 scheduled, 2 drafts)
-- ============================================================
