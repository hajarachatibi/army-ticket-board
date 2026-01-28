-- Lightweight RPC to fetch distinct filter values (events, cities, days, etc.) across all tickets.
-- Used for dropdown options so filters show all values, not just the first page.
-- Single round-trip, minimal data; safe for Supabase free tier.

CREATE OR REPLACE FUNCTION public.get_ticket_filter_options(p_owner_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'events',   COALESCE((SELECT json_agg(e ORDER BY e) FROM (SELECT DISTINCT event AS e FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json),
    'cities',   COALESCE((SELECT json_agg(c ORDER BY c) FROM (SELECT DISTINCT city AS c FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json),
    'days',     COALESCE((SELECT json_agg(d ORDER BY d) FROM (SELECT DISTINCT day::text AS d FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json),
    'sections', COALESCE((SELECT json_agg(s ORDER BY s) FROM (SELECT DISTINCT section AS s FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json),
    'rows',     COALESCE((SELECT json_agg(r ORDER BY r) FROM (SELECT DISTINCT seat_row AS r FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json),
    'quantities', COALESCE((SELECT json_agg(q ORDER BY q) FROM (SELECT DISTINCT quantity AS q FROM tickets WHERE (p_owner_id IS NULL OR owner_id = p_owner_id)) t), '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_filter_options(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_filter_options(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_ticket_filter_options(uuid) IS 'Returns distinct event, city, day, section, row, quantity for filter dropdowns. Pass owner_id to scope to my tickets.';
