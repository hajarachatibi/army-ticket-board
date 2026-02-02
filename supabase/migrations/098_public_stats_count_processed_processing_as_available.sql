-- Fix home stats mismatch:
-- Listings are inserted with status='processing' and processing_until +2min.
-- The UI treats processed 'processing' as effectively active, but public_stats() only counted status='active'.
-- Count both 'active' and 'processing' once processing_until has passed.

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    -- "tickets" == listings available to browse/connect (processed + not locked)
    'tickets', (
      SELECT count(*)::int
      FROM listings l
      WHERE l.status IN ('active', 'processing')
        AND l.processing_until <= now()
        AND l.locked_by IS NULL
    ),
    -- "events" == unique city+date pairs (from listings)
    'events', (
      SELECT count(*)::int
      FROM (
        SELECT DISTINCT (l.concert_city || '|' || l.concert_date::text) AS k
        FROM listings l
        WHERE l.processing_until <= now()
          AND l.status <> 'removed'
      ) x
    ),
    -- "sold" == tickets sold + listings sold
    'sold', (
      (SELECT count(*)::int FROM tickets t WHERE t.status = 'Sold')
      + (SELECT count(*)::int FROM listings l WHERE l.status = 'sold')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;

COMMENT ON FUNCTION public.public_stats() IS 'Public stats for home page: listings (available), events, sold (tickets+listings).';

