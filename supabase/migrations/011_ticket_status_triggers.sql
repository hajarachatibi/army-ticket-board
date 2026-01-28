-- Persist "Reported" ticket status via trigger (global; everyone sees it).
-- "Contacted" is user-specific (only the contacter sees it) and not stored in DB.

DROP TRIGGER IF EXISTS trg_chats_set_ticket_contacted ON public.chats;
DROP FUNCTION IF EXISTS public.set_ticket_contacted_on_chat_insert();

CREATE OR REPLACE FUNCTION public.set_ticket_reported_on_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
  SET status = 'Reported', updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_set_ticket_reported ON public.reports;
CREATE TRIGGER trg_reports_set_ticket_reported
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_reported_on_report_insert();

-- Revert any tickets previously set to Contacted (no longer persisted) back to Available.
UPDATE public.tickets SET status = 'Available', updated_at = now() WHERE status = 'Contacted';
