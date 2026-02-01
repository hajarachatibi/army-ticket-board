-- Optional explanation if price is not face value (fees, etc.)

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_explanation text;

