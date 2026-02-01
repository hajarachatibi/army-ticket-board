-- Remove ALL listings data (keeps schema).
-- This will cascade-delete listing seats, listing reports, connections,
-- and any connection-linked chats (but will not touch unrelated chats).

DELETE FROM public.listings;

