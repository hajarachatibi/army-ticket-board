-- Admin panel: switch from legacy tickets to listings + listing_reports.

-- 1) Dashboard stats (replace ticket counts with listing counts).
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
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
      'users', (SELECT count(*)::int FROM user_profiles),
      'listings', (SELECT count(*)::int FROM listings),
      'reports', (SELECT (SELECT count(*)::int FROM listing_reports) + (SELECT count(*)::int FROM user_reports)),
      'banned', (SELECT count(*)::int FROM banned_users),
      'sellers', (SELECT count(*)::int FROM user_profiles up WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)),
      'buyers', (SELECT count(*)::int FROM (
        SELECT DISTINCT buyer_id AS id FROM connections
      ) x)
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- 2) Listing reports with details (admin only).
CREATE OR REPLACE FUNCTION public.admin_listing_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      lr.id,
      lr.listing_id,
      lr.reporter_id,
      up_reporter.email AS reporter_email,
      lr.reported_by_username,
      lr.reason,
      lr.details,
      lr.created_at,
      l.seller_id AS seller_id,
      up_seller.email AS seller_email,
      l.concert_city,
      l.concert_date,
      l.status AS listing_status,
      s.section,
      s.seat_row,
      s.seat,
      s.face_value_price,
      s.currency
    FROM listing_reports lr
    JOIN listings l ON l.id = lr.listing_id
    LEFT JOIN user_profiles up_seller ON up_seller.id = l.seller_id
    LEFT JOIN user_profiles up_reporter ON up_reporter.id = lr.reporter_id
    JOIN LATERAL (
      SELECT section, seat_row, seat, face_value_price, currency
      FROM listing_seats
      WHERE listing_id = l.id
      ORDER BY seat_index ASC
      LIMIT 1
    ) s ON true
    WHERE public.is_admin()
    ORDER BY lr.created_at DESC
  ) r;
$$;
GRANT EXECUTE ON FUNCTION public.admin_listing_reports_with_details() TO authenticated;

-- 3) Delete listing report (admin only).
CREATE OR REPLACE FUNCTION public.admin_delete_listing_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.listing_reports WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing_report(uuid) TO authenticated;

-- 4) Admin: remove listing (sets status=removed, ends any connection).
CREATE OR REPLACE FUNCTION public.admin_remove_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_chat_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT c.chat_id INTO v_chat_id
  FROM public.connections c
  WHERE c.listing_id = p_listing_id
  LIMIT 1;

  IF v_chat_id IS NOT NULL THEN
    UPDATE public.chats SET status = 'closed', closed_at = now() WHERE id = v_chat_id;
  END IF;

  UPDATE public.connections
  SET stage = 'ended', stage_expires_at = now()
  WHERE listing_id = p_listing_id
    AND stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');

  UPDATE public.listings
  SET status = 'removed', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE id = p_listing_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_remove_listing(uuid) TO authenticated;

-- 5) Sellers list (paged) based on listings.
CREATE OR REPLACE FUNCTION public.admin_list_sellers_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total FROM user_profiles up
  WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)
    AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- 6) Buyers list (paged) based on connections.
CREATE OR REPLACE FUNCTION public.admin_list_buyers_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  WITH buyers AS (
    SELECT DISTINCT up.id
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM connections c WHERE c.buyer_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
  )
  SELECT count(*) INTO total FROM buyers;
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM connections c WHERE c.buyer_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- 7) Listings list (paged) with minimal seat info.
DROP FUNCTION IF EXISTS public.admin_listings_paged_filtered(int, int, text, text);
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

