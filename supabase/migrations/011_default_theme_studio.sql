-- Soft Studio is the product's default aesthetic
alter table settings alter column brand_theme set default 'studio';
update settings set brand_theme = 'studio' where id = 1 and brand_theme = 'playground';
