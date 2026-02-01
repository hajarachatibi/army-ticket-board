-- Reduce listing processing delay from 15 minutes to 2 minutes.
-- (New listings are inserted with processing_until; keep DB default aligned.)

ALTER TABLE public.listings
  ALTER COLUMN processing_until SET DEFAULT (now() + interval '2 minutes');

