-- Add unique constraint so each platform can only have one active connection
alter table platform_connections
  add constraint platform_connections_platform_unique unique (platform);
