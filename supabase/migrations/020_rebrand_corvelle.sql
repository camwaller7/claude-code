-- Rebrand: product is now Corvelle, default AI assistant persona is Elle
alter table settings
  alter column assistant_name set default 'Elle';

-- Update any existing settings row still using the old default name
update settings set assistant_name = 'Elle' where assistant_name = 'Nova';
