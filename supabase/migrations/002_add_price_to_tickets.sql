-- Add price (face value) to tickets. Run in Supabase SQL Editor after 001.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS price numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tickets.price IS 'Face value price per ticket (same currency for all; e.g. USD).';
