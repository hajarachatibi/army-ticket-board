-- Public stats should reflect listings (not legacy tickets).
-- Keeps the JSON keys stable: tickets/events/sold for backwards compatibility.

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    -- "tickets" == active listings visible in browse
    'tickets', (
      SELECT count(*)::int
      FROM listings l
      WHERE l.status = 'active'
        AND l.processing_until <= now()
        AND l.locked_by IS NULL
    ),
    -- "events" == unique city+date pairs
    'events', (
      SELECT count(*)::int
      FROM (
        SELECT DISTINCT (l.concert_city || '|' || l.concert_date::text) AS k
        FROM listings l
        WHERE l.processing_until <= now()
          AND l.status <> 'removed'
      ) x
    ),
    -- "sold" == sold listings
    'sold', (
      SELECT count(*)::int
      FROM listings l
      WHERE l.status = 'sold'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;

COMMENT ON FUNCTION public.public_stats() IS 'Public stats for home page: listings (available), events, sold.';

