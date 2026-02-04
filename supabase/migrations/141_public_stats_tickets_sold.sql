-- Add "tickets sold" stat: total quantities (legacy tickets) + total seats (sold listings).

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
    -- "sold" == count of ticket rows + listing rows sold (unchanged)
    'sold', (
      (SELECT count(*)::int FROM tickets t WHERE t.status = 'Sold')
      + (SELECT count(*)::int FROM listings l WHERE l.status = 'sold')
    ),
    -- "tickets_sold" == total seat/quantity count: sum(quantity) from sold tickets + count(seats) from sold listings
    'tickets_sold', (
      (SELECT COALESCE(SUM(t.quantity), 0)::int FROM tickets t WHERE t.status = 'Sold')
      + (SELECT count(*)::int FROM listing_seats ls JOIN listings l ON l.id = ls.listing_id WHERE l.status = 'sold')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;

COMMENT ON FUNCTION public.public_stats() IS 'Public stats for home page: listings (available), events, sold (counts), tickets_sold (total quantities+seats).';
