-- Rename Lounge to Loge (column and RPCs).

-- 1) Rename column
ALTER TABLE public.listings
  RENAME COLUMN lounge TO loge;

-- 2) browse_listings: expose loge
DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  status text,
  lock_expires_at timestamptz,
  vip boolean,
  loge boolean,
  seat_count int,
  seats json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS listing_id,
    l.concert_city,
    l.concert_date,
    l.status,
    l.lock_expires_at,
    COALESCE(l.vip, false) AS vip,
    COALESCE(l.loge, false) AS loge,
    (SELECT count(*)::int FROM public.listing_seats WHERE listing_id = l.id) AS seat_count,
    (SELECT COALESCE(json_agg(
      json_build_object(
        'section', s2.section,
        'seat_row', s2.seat_row,
        'seat', s2.seat,
        'face_value_price', s2.face_value_price,
        'currency', COALESCE(s2.currency, 'USD')
      ) ORDER BY s2.seat_index
    ), '[]'::json) FROM public.listing_seats s2 WHERE s2.listing_id = l.id) AS seats
  FROM public.listings l
  WHERE l.status IN ('processing','active','locked','sold')
    AND (l.processing_until IS NULL OR l.processing_until <= now())
    AND l.status <> 'removed'
  ORDER BY
    CASE
      WHEN l.status = 'sold' THEN 2
      WHEN l.status = 'locked' THEN 1
      ELSE 0
    END ASC,
    l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.browse_listings() TO authenticated;

-- 3) connection_listing_details: add vip and loge to listing object
DROP FUNCTION IF EXISTS public.connection_listing_details(uuid);
CREATE OR REPLACE FUNCTION public.connection_listing_details(p_connection_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_listing json;
  v_seats json;
BEGIN
  SELECT * INTO v
  FROM public.connections c
  WHERE c.id = p_connection_id;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT json_build_object(
    'id', l.id,
    'concert_city', l.concert_city,
    'concert_date', l.concert_date,
    'ticket_source', l.ticket_source,
    'ticketing_experience', l.ticketing_experience,
    'selling_reason', l.selling_reason,
    'price_explanation', l.price_explanation,
    'status', l.status,
    'created_at', l.created_at,
    'vip', COALESCE(l.vip, false),
    'loge', COALESCE(l.loge, false)
  )
  INTO v_listing
  FROM public.listings l
  WHERE l.id = v.listing_id;

  IF v_listing IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(json_agg(s ORDER BY s.seat_index ASC), '[]'::json)
  INTO v_seats
  FROM (
    SELECT seat_index, section, seat_row, seat, face_value_price, currency
    FROM public.listing_seats
    WHERE listing_id = v.listing_id
    ORDER BY seat_index ASC
  ) s;

  RETURN json_build_object('listing', v_listing, 'seats', v_seats);
END;
$$;

GRANT EXECUTE ON FUNCTION public.connection_listing_details(uuid) TO authenticated;
