-- Add currency to tickets. Run after 004.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

COMMENT ON COLUMN public.tickets.currency IS 'ISO 4217 currency code (e.g. USD, EUR, GBP, KRW).';
