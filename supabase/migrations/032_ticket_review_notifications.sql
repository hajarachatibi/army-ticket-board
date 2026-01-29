-- Ticket review notifications and reject reason.

-- 1. Store rejection reason on ticket (visible to seller).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.tickets.rejection_reason IS 'Reason provided by admin when rejecting a ticket.';

-- 2. Server-backed notifications (so admins can notify other users).
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ticket_approved', 'ticket_rejected')),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  ticket_summary text,
  message text,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_created ON public.user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_delivered ON public.user_notifications(user_id, delivered);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_update_own" ON public.user_notifications;
CREATE POLICY "user_notifications_update_own"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.user_notifications IS 'Server notifications for users (delivered=false means not yet shown in UI).';

-- Add to realtime publication so users can receive notifications live.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications'
  ) THEN
    -- already added
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

-- 3. Update admin approve/reject to create notifications.

-- Approve: clear claimed fields and rejection_reason; notify owner.
CREATE OR REPLACE FUNCTION public.admin_approve_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_event text; v_city text; v_day date; v_summary text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  UPDATE public.tickets
  SET listing_status = 'approved', claimed_by = NULL, claimed_at = NULL, rejection_reason = NULL
  WHERE id = p_ticket_id AND claimed_by = auth.uid()
  RETURNING owner_id, event, city, day INTO v_owner, v_event, v_city, v_day;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found or you did not claim it';
  END IF;

  v_summary := COALESCE(v_event, 'Ticket') || ' · ' || COALESCE(v_city, '—') || ' · ' || COALESCE(v_day::text, '—');

  INSERT INTO public.user_notifications (user_id, type, ticket_id, ticket_summary, message)
  VALUES (v_owner, 'ticket_approved', p_ticket_id, v_summary, 'Your ticket was approved and is now listed.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_approve_ticket(uuid) TO authenticated;

-- Reject: require non-empty reason; set rejection_reason; notify owner with reason.
DROP FUNCTION IF EXISTS public.admin_reject_ticket(uuid);
CREATE OR REPLACE FUNCTION public.admin_reject_ticket(p_ticket_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_event text; v_city text; v_day date; v_summary text; v_reason text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  v_reason := trim(coalesce(p_reason, ''));
  IF v_reason = '' THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;

  UPDATE public.tickets
  SET listing_status = 'rejected', claimed_by = NULL, claimed_at = NULL, rejection_reason = v_reason
  WHERE id = p_ticket_id AND claimed_by = auth.uid()
  RETURNING owner_id, event, city, day INTO v_owner, v_event, v_city, v_day;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found or you did not claim it';
  END IF;

  v_summary := COALESCE(v_event, 'Ticket') || ' · ' || COALESCE(v_city, '—') || ' · ' || COALESCE(v_day::text, '—');

  INSERT INTO public.user_notifications (user_id, type, ticket_id, ticket_summary, message)
  VALUES (v_owner, 'ticket_rejected', p_ticket_id, v_summary, 'Your ticket was rejected: ' || v_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_ticket(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_approve_ticket(uuid) IS 'Approve ticket (only claimer) and notify owner.';
COMMENT ON FUNCTION public.admin_reject_ticket(uuid, text) IS 'Reject ticket with reason (only claimer) and notify owner.';

