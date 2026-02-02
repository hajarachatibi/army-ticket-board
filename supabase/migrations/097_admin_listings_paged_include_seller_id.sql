-- Admin listings table: include seller_id so UI can open seller profile.

CREATE OR REPLACE FUNCTION public.admin_listings_paged_filtered(
  p_limit int,
  p_offset int,
  p_search text DEFAULT '',
  p_status text DEFAULT '' -- '', 'active', 'sold', 'removed', 'processing', 'locked'
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text; status_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  status_trim := trim(coalesce(p_status, ''));

  SELECT count(*) INTO total
  FROM public.listings l
  LEFT JOIN public.user_profiles up ON up.id = l.seller_id
  WHERE (status_trim = '' OR l.status = status_trim)
    AND (
      search_trim = ''
      OR l.concert_city ILIKE '%' || search_trim || '%'
      OR l.concert_date::text ILIKE '%' || search_trim || '%'
      OR up.email ILIKE '%' || search_trim || '%'
    );

  SELECT json_agg(t) INTO rows
  FROM (
    SELECT
      l.id,
      l.seller_id,
      l.concert_city,
      l.concert_date,
      l.status,
      l.created_at,
      up.email AS seller_email,
      s.section,
      s.seat_row,
      s.seat,
      s.face_value_price,
      s.currency
    FROM public.listings l
    LEFT JOIN public.user_profiles up ON up.id = l.seller_id
    JOIN LATERAL (
      SELECT section, seat_row, seat, face_value_price, currency
      FROM public.listing_seats
      WHERE listing_id = l.id
      ORDER BY seat_index ASC
      LIMIT 1
    ) s ON true
    WHERE (status_trim = '' OR l.status = status_trim)
      AND (
        search_trim = ''
        OR l.concert_city ILIKE '%' || search_trim || '%'
        OR l.concert_date::text ILIKE '%' || search_trim || '%'
        OR up.email ILIKE '%' || search_trim || '%'
      )
    ORDER BY l.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;

  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_listings_paged_filtered(int, int, text, text) TO authenticated;

