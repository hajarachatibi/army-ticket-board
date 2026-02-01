-- Migrate ALL legacy tickets -> listings (even if not approved yet).
-- Idempotent via listings.legacy_ticket_id.
--
-- Status mapping:
-- - rejected/removed_at -> listings.status = 'removed'
-- - Sold -> 'sold'
-- - pending_review -> 'processing' (15 min delay)
-- - approved -> 'active' (immediately visible)
-- - other -> 'processing' (safe default)
--
-- IMPORTANT: This migration temporarily disables the "max 5 active listings" trigger
-- so existing sellers with many tickets can be imported.

-- Ensure legacy_ticket_id exists
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS legacy_ticket_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_listings_legacy_ticket_id
  ON public.listings(legacy_ticket_id)
  WHERE legacy_ticket_id IS NOT NULL;

-- Temporarily disable max-active trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'listings_enforce_max_active'
  ) THEN
    EXECUTE 'ALTER TABLE public.listings DISABLE TRIGGER listings_enforce_max_active';
  END IF;
END $$;

-- Insert listings for any legacy tickets not yet migrated
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
  ('Migrated from legacy ticket' || CASE WHEN COALESCE(t.quantity, 1) > 1 THEN (' (qty: ' || t.quantity::text || ')') ELSE '' END)::text AS selling_reason,
  CASE
    WHEN t.removed_at IS NOT NULL OR t.listing_status = 'rejected' THEN 'removed'
    WHEN t.status = 'Sold' THEN 'sold'
    WHEN t.listing_status = 'approved' THEN 'active'
    WHEN t.listing_status = 'pending_review' THEN 'processing'
    ELSE 'processing'
  END AS status,
  CASE
    WHEN (t.removed_at IS NOT NULL OR t.listing_status = 'rejected') THEN now() - interval '1 minute'
    WHEN t.status = 'Sold' THEN now() - interval '1 minute'
    WHEN t.listing_status = 'approved' THEN now() - interval '1 minute'
    ELSE now() + interval '15 minutes'
  END AS processing_until,
  t.created_at,
  now() AS updated_at
FROM public.tickets t
WHERE t.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.listings l WHERE l.legacy_ticket_id = t.id
  );

-- Insert a representative seat row
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

-- Re-enable max-active trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'listings_enforce_max_active'
  ) THEN
    EXECUTE 'ALTER TABLE public.listings ENABLE TRIGGER listings_enforce_max_active';
  END IF;
END $$;

