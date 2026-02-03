-- Expose seat count (quantity) and ALL seats in browse_listings for display and filtering.

DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  status text,
  lock_expires_at timestamptz,
  vip boolean,
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
