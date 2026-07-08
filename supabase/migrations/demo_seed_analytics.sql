-- ============================================================
-- ANALYTICS DEMO SEED — run in Supabase SQL Editor after 010
-- 30 days of follower history + realistic post metrics so the
-- Audience dashboard and AI growth coaching have data to work with.
-- Safe to re-run.
-- ============================================================

delete from follower_snapshots;
delete from content_metrics;

-- ---- Follower history: steady growth with a viral bump ~10 days ago ----
insert into follower_snapshots (platform, followers, snapshot_date)
select 'instagram',
       47200 + (30 - d) * 85 + case when d <= 10 then 2400 else 0 end + (random() * 40)::int,
       (current_date - d)
from generate_series(30, 0, -1) as d;

insert into follower_snapshots (platform, followers, snapshot_date)
select 'tiktok',
       31500 + (30 - d) * 140 + case when d <= 10 then 3800 else 0 end + (random() * 60)::int,
       (current_date - d)
from generate_series(30, 0, -1) as d;

insert into follower_snapshots (platform, followers, snapshot_date)
select 'x',
       12800 + (30 - d) * 25 + (random() * 15)::int,
       (current_date - d)
from generate_series(30, 0, -1) as d;

insert into follower_snapshots (platform, followers, snapshot_date)
select 'facebook',
       8900 + (30 - d) * 12 + (random() * 10)::int,
       (current_date - d)
from generate_series(30, 0, -1) as d;

-- ---- Post metrics: reels clearly outperform; evenings beat mornings ----
insert into content_metrics (platform, external_post_id, caption, media_type, views, likes, comments, shares, saves, follows_gained, posted_at) values
  ('instagram', 'demo_m_001', 'Behind the scenes of my most viral reel 🎬 From concept to 2.3M views', 'reel',   2310000, 187000, 4200, 31000, 24000, 4100, now() - interval '10 days' + interval '19 hours'),
  ('tiktok',    'demo_m_002', 'POV: you finally figured out the algorithm 👀', 'video',                              845000,  93000, 2900, 18500,  8800, 2600, now() - interval '9 days' + interval '20 hours'),
  ('instagram', 'demo_m_003', 'Morning routine that changed my life ✨', 'reel',                                     412000,  38000, 1100,  4200,  6900,  820, now() - interval '6 days' + interval '18 hours'),
  ('instagram', 'demo_m_004', 'The content creator toolkit I actually use every day', 'carousel',                    98000,   8400,  620,   900,  4100,  310, now() - interval '5 days' + interval '12 hours'),
  ('tiktok',    'demo_m_005', 'Rating viral productivity hacks so you don''t have to', 'video',                     289000,  31000,  980,  5600,  3400,  740, now() - interval '4 days' + interval '19 hours'),
  ('instagram', 'demo_m_006', 'Golden hour photo dump 🌅', 'image',                                                  45000,   5100,  340,   210,   380,   95, now() - interval '3 days' + interval '8 hours'),
  ('x',         'demo_m_007', 'This brand deal almost didn''t happen — negotiation thread 💸', 'text',               156000,   4800,  520,  2100,  1900,  410, now() - interval '3 days' + interval '13 hours'),
  ('instagram', 'demo_m_008', 'Honest review: 30 days with the new camera setup', 'reel',                           331000,  27000,  890,  3800,  5200,  680, now() - interval '2 days' + interval '19 hours'),
  ('facebook',  'demo_m_009', 'Longer-form: how I plan a month of content in one afternoon', 'video',                34000,   2100,  280,   450,   190,   60, now() - interval '2 days' + interval '11 hours'),
  ('instagram', 'demo_m_010', 'Q&A: answering your most-asked questions', 'image',                                   38000,   4200,  710,   150,   260,   85, now() - interval '1 day' + interval '17 hours'),
  ('tiktok',    'demo_m_011', 'Day in the life — brand shoot edition 🎥', 'video',                                  198000,  22000,  760,  3100,  2200,  520, now() - interval '1 day' + interval '20 hours'),
  ('instagram', 'demo_m_012', 'Unpopular opinion: you don''t need to post every day', 'reel',                       267000,  29000, 1400,  5900,  7100,  910, now() - interval '14 hours'),
  ('x',         'demo_m_013', 'What I''d tell myself at 1k followers 🧵', 'text',                                    89000,   3100,  410,  1600,  1100,  260, now() - interval '8 days' + interval '14 hours'),
  ('instagram', 'demo_m_014', 'Gym fit check + supplement routine', 'image',                                         29000,   3400,  190,    90,   210,   40, now() - interval '7 days' + interval '7 hours'),
  ('tiktok',    'demo_m_015', 'Trying the viral 5-9 before my 9-5 trend', 'video',                                  512000,  56000, 1800,  9800,  5100, 1300, now() - interval '12 days' + interval '19 hours');

-- Done: expect followers ~100k total, reels/video dominating, evening posts winning.
