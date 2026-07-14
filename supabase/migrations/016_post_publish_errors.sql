-- publishPost previously only recorded successful platform_post_ids; if one
-- platform in a multi-platform post failed while another succeeded, the post
-- was marked "published" with no record of which platform(s) actually failed.
alter table posts add column if not exists publish_errors jsonb;
