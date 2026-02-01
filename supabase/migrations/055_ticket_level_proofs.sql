-- Merge seller proof into per-ticket submission proofs.
-- Each ticket can carry standardized proof attachments (stored as private storage object paths).

-- 1) Tickets: add proof fields (nullable for existing tickets).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS proof_tm_ticket_page_path text;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS proof_tm_screen_recording_path text;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS proof_tm_email_screenshot_path text;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS proof_price_note text;

COMMENT ON COLUMN public.tickets.proof_tm_ticket_page_path IS
  'Private storage object path. Screenshot of TM ticket page (with today''s date + handwritten name).';
COMMENT ON COLUMN public.tickets.proof_tm_screen_recording_path IS
  'Private storage object path. Screen recording scrolling TM app.';
COMMENT ON COLUMN public.tickets.proof_tm_email_screenshot_path IS
  'Private storage object path. Screenshot of TM email (sensitive info hidden).';
COMMENT ON COLUMN public.tickets.proof_price_note IS
  'Optional note if listed price differs from face value (fees, etc).';

-- 2) Storage policy: allow uploads into ticket-proofs/<userId>/...
DROP POLICY IF EXISTS "Proof attachments: authenticated upload own" ON storage.objects;
CREATE POLICY "Proof attachments: authenticated upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proof-attachments'
    AND (
      name LIKE ('user-reports/' || auth.uid()::text || '/%')
      OR name LIKE ('seller-proof/' || auth.uid()::text || '/%')
      OR name LIKE ('ticket-proofs/' || auth.uid()::text || '/%')
    )
  );

-- 3) Admin pending tickets: include proof fields for review.
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
      t.proof_tm_ticket_page_path,
      t.proof_tm_screen_recording_path,
      t.proof_tm_email_screenshot_path,
      t.proof_price_note,
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

-- 4) Admin tickets paged: include proof fields.
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
      t.proof_tm_ticket_page_path,
      t.proof_tm_screen_recording_path,
      t.proof_tm_email_screenshot_path,
      t.proof_price_note,
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

-- 5) Admin tickets paged filtered: include proof fields.
CREATE OR REPLACE FUNCTION public.admin_tickets_paged_filtered(
  p_limit int,
  p_offset int,
  p_search text DEFAULT '',
  p_ticket_status text DEFAULT NULL,
  p_listing_status text DEFAULT NULL,
  p_claimed_state text DEFAULT NULL  -- 'claimed' | 'unclaimed' | NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
  search_trim text;
  st text;
  ls text;
  cs text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  search_trim := trim(coalesce(p_search, ''));
  st := NULLIF(trim(coalesce(p_ticket_status, '')), '');
  ls := NULLIF(trim(coalesce(p_listing_status, '')), '');
  cs := NULLIF(trim(coalesce(p_claimed_state, '')), '');

  IF cs IS NOT NULL AND cs NOT IN ('claimed', 'unclaimed') THEN
    RAISE EXCEPTION 'Invalid claimed_state';
  END IF;

  SELECT count(*) INTO total
  FROM tickets t
  LEFT JOIN user_profiles up ON up.id = t.owner_id
  WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%')
    AND (st IS NULL OR t.status = st)
    AND (ls IS NULL OR t.listing_status = ls)
    AND (
      cs IS NULL
      OR (cs = 'claimed' AND t.claimed_by IS NOT NULL)
      OR (cs = 'unclaimed' AND t.claimed_by IS NULL)
    );

  SELECT json_agg(x) INTO rows
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
      t.proof_tm_ticket_page_path,
      t.proof_tm_screen_recording_path,
      t.proof_tm_email_screenshot_path,
      t.proof_price_note,
      up.email AS owner_email,
      up_claimer.email AS claimed_by_email
    FROM tickets t
    LEFT JOIN user_profiles up ON up.id = t.owner_id
    LEFT JOIN user_profiles up_claimer ON up_claimer.id = t.claimed_by
    WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%')
      AND (st IS NULL OR t.status = st)
      AND (ls IS NULL OR t.listing_status = ls)
      AND (
        cs IS NULL
        OR (cs = 'claimed' AND t.claimed_by IS NOT NULL)
        OR (cs = 'unclaimed' AND t.claimed_by IS NULL)
      )
    ORDER BY t.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;

  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

