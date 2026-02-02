-- DANGEROUS: Clear all existing listings, connections, and admin channel posts.
-- This is intended for resetting a staging/dev environment.
-- It will cascade-delete related rows (listing_seats, listing_reports, admin_channel_replies/reactions, chats tied to connections, etc.).

-- 1) Admin Channel
DELETE FROM public.admin_channel_posts;

-- 2) Connections (in case any remain without listings for some reason)
DELETE FROM public.connections;

-- 3) Listings (cascades to listing_seats, listing_reports, connections, etc.)
DELETE FROM public.listings;

