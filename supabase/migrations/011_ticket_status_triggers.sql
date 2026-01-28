-- Persist "Contacted" and "Reported" ticket status via triggers.
-- Chats insert (buyer contacts): set ticket status to Contacted when Available.
-- Reports insert: set ticket status to Reported.

CREATE OR REPLACE FUNCTION public.set_ticket_contacted_on_chat_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
  SET status = 'Contacted', updated_at = now()
  WHERE id = NEW.ticket_id AND status = 'Available';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chats_set_ticket_contacted ON public.chats;
CREATE TRIGGER trg_chats_set_ticket_contacted
  AFTER INSERT ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_contacted_on_chat_insert();

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
