-- Ticket review workflow: new tickets go to admin first; admin claims, chats, approves/rejects.
-- Only approved tickets appear in browse.

-- 1. Add listing_status, claimed_by, claimed_at to tickets.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'approved'
    CHECK (listing_status IN ('pending_review', 'approved', 'rejected'));
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Existing rows keep 'approved'. New inserts use 'pending_review'.
ALTER TABLE public.tickets ALTER COLUMN listing_status SET DEFAULT 'pending_review';

CREATE INDEX IF NOT EXISTS idx_tickets_listing_status ON public.tickets(listing_status);
CREATE INDEX IF NOT EXISTS idx_tickets_claimed_by ON public.tickets(claimed_by);

COMMENT ON COLUMN public.tickets.listing_status IS 'pending_review: admin queue; approved: in browse; rejected: never listed.';
COMMENT ON COLUMN public.tickets.claimed_by IS 'Admin who picked up the ticket for review.';
COMMENT ON COLUMN public.tickets.claimed_at IS 'When the ticket was claimed.';

-- 2. Allow admins to UPDATE tickets (claim, approve, reject).
DROP POLICY IF EXISTS "tickets_update_admin" ON public.tickets;
CREATE POLICY "tickets_update_admin"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (true);

-- 3. Filter options: browse (p_owner_id NULL) = approved only; my tickets = all owner's.
DROP FUNCTION IF EXISTS public.get_ticket_filter_options(uuid);
CREATE OR REPLACE FUNCTION public.get_ticket_filter_options(p_owner_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'events',   COALESCE((SELECT json_agg(e ORDER BY e) FROM (SELECT DISTINCT event AS e FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json),
    'cities',   COALESCE((SELECT json_agg(c ORDER BY c) FROM (SELECT DISTINCT city AS c FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json),
    'days',     COALESCE((SELECT json_agg(d ORDER BY d) FROM (SELECT DISTINCT day::text AS d FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json),
    'sections', COALESCE((SELECT json_agg(s ORDER BY s) FROM (SELECT DISTINCT section AS s FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json),
    'rows',     COALESCE((SELECT json_agg(r ORDER BY r) FROM (SELECT DISTINCT seat_row AS r FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json),
    'quantities', COALESCE((SELECT json_agg(q ORDER BY q) FROM (SELECT DISTINCT quantity AS q FROM tickets tt WHERE (p_owner_id IS NULL AND tt.listing_status = 'approved') OR (p_owner_id IS NOT NULL AND tt.owner_id = p_owner_id)) f), '[]'::json)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_ticket_filter_options(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_filter_options(uuid) TO authenticated;

-- 4. Public stats: tickets and events only from approved listings.
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'tickets', (SELECT count(*)::int FROM tickets WHERE status = 'Available' AND listing_status = 'approved'),
    'events', (SELECT count(*)::int FROM (SELECT DISTINCT event FROM tickets WHERE listing_status = 'approved') x),
    'sold', (SELECT count(*)::int FROM tickets WHERE status = 'Sold')
  );
$$;

-- 5. Admin claim ticket (pending only, not already claimed).
CREATE OR REPLACE FUNCTION public.admin_claim_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.tickets
  SET claimed_by = auth.uid(), claimed_at = now()
  WHERE id = p_ticket_id
    AND listing_status = 'pending_review'
    AND claimed_by IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found, not pending, or already claimed';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_claim_ticket(uuid) TO authenticated;

-- 6. Admin approve ticket (only claimer).
CREATE OR REPLACE FUNCTION public.admin_approve_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.tickets
  SET listing_status = 'approved', claimed_by = NULL, claimed_at = NULL
  WHERE id = p_ticket_id AND claimed_by = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found or you did not claim it';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_approve_ticket(uuid) TO authenticated;

-- 7. Admin reject ticket (only claimer).
CREATE OR REPLACE FUNCTION public.admin_reject_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.tickets
  SET listing_status = 'rejected', claimed_by = NULL, claimed_at = NULL
  WHERE id = p_ticket_id AND claimed_by = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found or you did not claim it';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_ticket(uuid) TO authenticated;

-- 8. Admin pending tickets (listing_status = pending_review) with claimed_by email.
CREATE OR REPLACE FUNCTION public.admin_pending_tickets()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rows json;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT COALESCE(json_agg(x), '[]'::json) INTO rows
  FROM (
    SELECT
      t.id,
      t.event,
      t.city,
      t.day,
      t.vip,
      t.quantity,
      t.section,
      t.seat_row,
      t.seat,
      t.type,
      t.status,
      t.owner_id,
      t.price,
      t.currency,
      t.created_at,
      t.listing_status,
      t.claimed_by,
      t.claimed_at,
      up_owner.email AS owner_email,
      up_claimer.email AS claimed_by_email
    FROM tickets t
    LEFT JOIN user_profiles up_owner ON up_owner.id = t.owner_id
    LEFT JOIN user_profiles up_claimer ON up_claimer.id = t.claimed_by
    WHERE t.listing_status = 'pending_review'
    ORDER BY t.claimed_at DESC NULLS LAST, t.created_at DESC
  ) x;
  RETURN rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_pending_tickets() TO authenticated;

-- 9. Extend admin_tickets_paged: add listing_status, claimed_by, claimed_by_email, owner_id.
DROP FUNCTION IF EXISTS public.admin_tickets_paged(int, int, text);
CREATE OR REPLACE FUNCTION public.admin_tickets_paged(
  p_limit int,
  p_offset int,
  p_search text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total
  FROM tickets t
  LEFT JOIN user_profiles up ON up.id = t.owner_id
  WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(x) INTO rows
  FROM (
    SELECT
      t.id, t.event, t.city, t.day, t.vip, t.quantity, t.section, t.seat_row, t.seat, t.type,
      t.status, t.owner_id, t.price, t.currency, t.created_at,
      t.listing_status, t.claimed_by, t.claimed_at,
      up.email AS owner_email,
      up_claimer.email AS claimed_by_email
    FROM tickets t
    LEFT JOIN user_profiles up ON up.id = t.owner_id
    LEFT JOIN user_profiles up_claimer ON up_claimer.id = t.claimed_by
    WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY t.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_tickets_paged(int, int, text) TO authenticated;

COMMENT ON FUNCTION public.admin_claim_ticket(uuid) IS 'Admin picks up a pending ticket for review.';
COMMENT ON FUNCTION public.admin_approve_ticket(uuid) IS 'Admin approves; ticket appears in browse.';
COMMENT ON FUNCTION public.admin_reject_ticket(uuid) IS 'Admin rejects; ticket never listed.';
COMMENT ON FUNCTION public.admin_pending_tickets() IS 'Tickets awaiting review; includes claimed_by_email.';
