-- Include seller answers (where bought, ticketing experience, why selling) in connection listing details
-- so "View ticket" in My Connection shows them.

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
    'created_at', l.created_at
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
