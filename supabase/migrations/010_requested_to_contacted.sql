-- Replace ticket status "Requested" with "Contacted".
-- Update existing rows, then change the CHECK constraint.

UPDATE public.tickets SET status = 'Contacted' WHERE status = 'Requested';

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('Available', 'Contacted', 'Reported', 'Sold'));
