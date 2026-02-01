-- Migrate legacy tickets -> new listings system.
-- Creates a listing per legacy ticket (idempotent via legacy_ticket_id).
--
-- Migrated ticket mapping:
-- - tickets.city -> listings.concert_city
-- - tickets.day  -> listings.concert_date
-- - tickets.price/currency -> listing_seats.face_value_price/currency
-- - ticket_source -> 'Other' (legacy tickets didn't track source)
-- - ticketing_experience / selling_reason -> "Migrated from legacy ticket"
--
-- Visibility:
-- - Only migrate tickets that were previously visible to buyers:
--   listing_status = 'approved' AND status = 'Available' AND removed_at IS NULL

-- Allow multiple migrated listings per seller by tracking origin on the listing row.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS legacy_ticket_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_listings_legacy_ticket_id
  ON public.listings(legacy_ticket_id)
  WHERE legacy_ticket_id IS NOT NULL;

-- NOTE:
-- The app originally enforced "one active listing at a time" for sellers.
-- Legacy data may include multiple tickets per seller, so migration creates multiple listings.
-- If you still have a unique index restricting this, drop it here.
DROP INDEX IF EXISTS uniq_listings_one_active_per_seller;

-- Insert listings (one per legacy ticket)
INSERT INTO public.listings (
  legacy_ticket_id,
  seller_id,
  concert_city,
  concert_date,
  ticket_source,
  ticketing_experience,
  selling_reason,
  status,
  processing_until,
  created_at,
  updated_at
)
SELECT
  t.id AS legacy_ticket_id,
  t.owner_id AS seller_id,
  t.city AS concert_city,
  t.day AS concert_date,
  'Other'::text AS ticket_source,
  'Migrated from legacy ticket'::text AS ticketing_experience,
  'Migrated from legacy ticket'::text AS selling_reason,
  'active'::text AS status,
  now() - interval '1 minute' AS processing_until,
  t.created_at,
  now() AS updated_at
FROM public.tickets t
WHERE t.owner_id IS NOT NULL
  AND t.listing_status = 'approved'
  AND t.status = 'Available'
  AND (t.removed_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.listings l WHERE l.legacy_ticket_id = t.id
  );

-- Insert listing seat (single representative seat per ticket row)
INSERT INTO public.listing_seats (
  listing_id,
  seat_index,
  section,
  seat_row,
  seat,
  face_value_price,
  currency,
  created_at
)
SELECT
  l.id AS listing_id,
  1 AS seat_index,
  t.section,
  t.seat_row,
  t.seat,
  COALESCE(t.price, 0)::numeric AS face_value_price,
  COALESCE(t.currency, 'USD')::text AS currency,
  now() AS created_at
FROM public.listings l
JOIN public.tickets t ON t.id = l.legacy_ticket_id
WHERE l.legacy_ticket_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.listing_seats s
    WHERE s.listing_id = l.id AND s.seat_index = 1
  );

