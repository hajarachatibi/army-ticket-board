-- Admin: growth and flow comparison stats (users, listings, sold, connections old vs new flow).

CREATE OR REPLACE FUNCTION public.admin_growth_and_flow_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN (
    SELECT json_build_object(
      -- Users growth
      'users_total', (SELECT count(*)::int FROM user_profiles),
      'users_last_7d', (SELECT count(*)::int FROM user_profiles WHERE created_at >= now() - interval '7 days'),
      'users_last_30d', (SELECT count(*)::int FROM user_profiles WHERE created_at >= now() - interval '30 days'),
      -- Listings growth
      'listings_total', (SELECT count(*)::int FROM listings),
      'listings_last_7d', (SELECT count(*)::int FROM listings WHERE created_at >= now() - interval '7 days'),
      'listings_last_30d', (SELECT count(*)::int FROM listings WHERE created_at >= now() - interval '30 days'),
      -- Sold (listings with status = sold; "sold in period" uses updated_at as proxy for when marked sold)
      'sold_total', (SELECT count(*)::int FROM listings WHERE status = 'sold'),
      'sold_last_7d', (SELECT count(*)::int FROM listings WHERE status = 'sold' AND updated_at >= now() - interval '7 days'),
      'sold_last_30d', (SELECT count(*)::int FROM listings WHERE status = 'sold' AND updated_at >= now() - interval '30 days'),
      -- Connections: new flow = buyer_want_social_share IS NOT NULL, old flow = NULL
      'connections_v2_total', (SELECT count(*)::int FROM connections WHERE buyer_want_social_share IS NOT NULL),
      'connections_legacy_total', (SELECT count(*)::int FROM connections WHERE buyer_want_social_share IS NULL),
      'connections_last_7d', (SELECT count(*)::int FROM connections WHERE created_at >= now() - interval '7 days'),
      'connections_last_30d', (SELECT count(*)::int FROM connections WHERE created_at >= now() - interval '30 days'),
      -- Ended (reached chat / completed) in period
      'ended_last_7d', (SELECT count(*)::int FROM connections WHERE stage = 'ended' AND updated_at >= now() - interval '7 days'),
      'ended_last_30d', (SELECT count(*)::int FROM connections WHERE stage = 'ended' AND updated_at >= now() - interval '30 days'),
      'ended_v2_total', (SELECT count(*)::int FROM connections WHERE stage = 'ended' AND buyer_want_social_share IS NOT NULL),
      'ended_legacy_total', (SELECT count(*)::int FROM connections WHERE stage = 'ended' AND buyer_want_social_share IS NULL)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_growth_and_flow_stats() TO authenticated;

COMMENT ON FUNCTION public.admin_growth_and_flow_stats() IS 'Admin-only: growth (users/listings/sold/connections by period) and old vs new connection flow counts.';
