-- Admin: view a listing (full seat list + seller info).

DROP FUNCTION IF EXISTS public.admin_listing_details(uuid);
CREATE OR REPLACE FUNCTION public.admin_listing_details(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing json;
  v_seats json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT json_build_object(
    'id', l.id,
    'seller_id', l.seller_id,
    'seller_email', up.email,
    'concert_city', l.concert_city,
    'concert_date', l.concert_date,
    'status', l.status,
    'created_at', l.created_at,
    'locked_by', l.locked_by,
    'locked_at', l.locked_at,
    'lock_expires_at', l.lock_expires_at
  )
  INTO v_listing
  FROM public.listings l
  LEFT JOIN public.user_profiles up ON up.id = l.seller_id
  WHERE l.id = p_listing_id;

  IF v_listing IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(json_agg(s ORDER BY s.seat_index ASC), '[]'::json)
  INTO v_seats
  FROM (
    SELECT
      ls.seat_index,
      ls.section,
      ls.seat_row,
      ls.seat,
      ls.face_value_price,
      ls.currency
    FROM public.listing_seats ls
    WHERE ls.listing_id = p_listing_id
    ORDER BY ls.seat_index ASC
  ) s;

  RETURN json_build_object(
    'listing', v_listing,
    'seats', v_seats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listing_details(uuid) TO authenticated;

