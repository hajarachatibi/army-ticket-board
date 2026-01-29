-- Admin tickets: filtered pagination helpers for the split tickets view.

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

GRANT EXECUTE ON FUNCTION public.admin_tickets_paged_filtered(int, int, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_tickets_paged_filtered(int, int, text, text, text, text)
  IS 'Admin paged tickets with optional filters for status/listing_status/claimed_state.';

