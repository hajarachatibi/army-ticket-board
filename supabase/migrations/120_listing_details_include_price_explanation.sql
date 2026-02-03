-- Include price_explanation in connection ticket details and browse seller details.

-- 1) connection_listing_details: add price_explanation to listing object
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
    'status', l.status,
    'created_at', l.created_at,
    'price_explanation', l.price_explanation
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

-- 2) get_browse_listing_seller_details: add priceExplanation to response
DROP FUNCTION IF EXISTS public.get_browse_listing_seller_details(uuid);
CREATE OR REPLACE FUNCTION public.get_browse_listing_seller_details(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_ticket_source text;
  v_ticketing_experience text;
  v_selling_reason text;
  v_price_explanation text;
BEGIN
  SELECT l.id, l.ticket_source, l.ticketing_experience, l.selling_reason, l.price_explanation
  INTO v_listing_id, v_ticket_source, v_ticketing_experience, v_selling_reason, v_price_explanation
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND l.status IN ('processing', 'active', 'locked', 'sold')
    AND l.status <> 'removed'
    AND (l.processing_until IS NULL OR l.processing_until <= now());

  IF v_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found or not available';
  END IF;

  RETURN json_build_object(
    'ticketSource', COALESCE(v_ticket_source, ''),
    'ticketingExperience', COALESCE(v_ticketing_experience, ''),
    'sellingReason', COALESCE(v_selling_reason, ''),
    'priceExplanation', COALESCE(v_price_explanation, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_browse_listing_seller_details(uuid) TO authenticated;
