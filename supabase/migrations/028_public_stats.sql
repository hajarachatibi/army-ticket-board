-- Public stats for home page (no auth required).

CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'tickets', (SELECT count(*)::int FROM tickets WHERE status = 'Available'),
    'events', (SELECT count(*)::int FROM (SELECT DISTINCT event FROM tickets) x),
    'sold', (SELECT count(*)::int FROM tickets WHERE status = 'Sold')
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;

COMMENT ON FUNCTION public.public_stats() IS 'Public stats for home page: tickets (available), events, sold.';
