-- Listings show in All Listings immediately (no 2-minute processing delay).
-- 1) Backfill: make existing listings visible now (processing_until in the past).
UPDATE public.listings
SET processing_until = now()
WHERE status IN ('processing', 'active', 'locked')
  AND processing_until > now();

-- 2) Default for new rows: no delay (column is NOT NULL; app/API can still set explicitly).
ALTER TABLE public.listings
  ALTER COLUMN processing_until SET DEFAULT now();

COMMENT ON COLUMN public.listings.processing_until IS 'When listing becomes visible in browse; default now() so listings show immediately.';
