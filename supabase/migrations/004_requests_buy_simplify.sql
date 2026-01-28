-- Simplify requests for "Buy" flow: no form, so event/seat_preference can be empty.
-- Run after 003.

ALTER TABLE public.requests
  ALTER COLUMN event DROP NOT NULL,
  ALTER COLUMN seat_preference DROP NOT NULL;

-- Allow empty string or minimal placeholder when inserting
COMMENT ON COLUMN public.requests.event IS 'Optional; ticket has full details. Use ticket event or empty for Buy.';
COMMENT ON COLUMN public.requests.seat_preference IS 'Optional; use "—" or empty for simple Buy.';
