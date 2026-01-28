-- Remove Contacted and Reported statuses. Keep only Available and Sold.

-- Drop Reported trigger and function (no longer set status to Reported).
DROP TRIGGER IF EXISTS trg_reports_set_ticket_reported ON public.reports;
DROP FUNCTION IF EXISTS public.set_ticket_reported_on_report_insert();

-- Revert Contacted/Reported to Available.
UPDATE public.tickets SET status = 'Available', updated_at = now() WHERE status IN ('Contacted', 'Reported');

-- Restrict status to Available and Sold only.
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('Available', 'Sold'));
