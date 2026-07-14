-- clients.conversation_id and deals.conversation_id are both queried
-- (LinkConversation lookups, client/deal-by-conversation joins) but had no
-- backing index — only messages.conversation_id was indexed.
create index if not exists idx_clients_conversation_id on clients (conversation_id);
create index if not exists idx_deals_conversation_id on deals (conversation_id);
