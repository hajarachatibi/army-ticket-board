-- One-off cleanup: remove all existing listings and connections.
-- Use this to reset the board (e.g. after testing or before a fresh launch).
--
-- CASCADE order:
-- 1) DELETE listings → cascades to listing_seats, listing_reports, connections
-- 2) Each connection deleted → cascades to chats (connection_id), user_notifications (connection_id)
-- User profiles and other app data are left unchanged.

DELETE FROM public.listings;
