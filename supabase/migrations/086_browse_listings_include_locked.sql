-- Update browse_listings() to include locked listings (shown as locked in UI).

DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  section text,
  seat_row text,
  seat text,
  face_value_price numeric,
  currency text,
  status text
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
    s.section,
    s.seat_row,
    s.seat,
    s.face_value_price,
    s.currency,
    l.status
  FROM public.listings l
  JOIN LATERAL (
    SELECT section, seat_row, seat, face_value_price, currency
    FROM public.listing_seats
    WHERE listing_id = l.id
    ORDER BY seat_index ASC
    LIMIT 1
  ) s ON true
  WHERE l.status IN ('processing','active','locked','sold')
    AND l.processing_until <= now()
    AND l.status <> 'removed'
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.browse_listings() TO authenticated;

