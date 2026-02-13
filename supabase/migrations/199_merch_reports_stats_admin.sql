-- Merch listing reports (mirror listing_reports), stats, and admin RPCs.

-- =============================================================================
-- 1) merch_listing_reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.merch_listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merch_listing_id uuid NOT NULL REFERENCES public.merch_listings(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reported_by_username text,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_merch_listing_reports_listing ON public.merch_listing_reports(merch_listing_id);
CREATE INDEX IF NOT EXISTS idx_merch_listing_reports_reporter ON public.merch_listing_reports(reporter_id);

ALTER TABLE public.merch_listing_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merch_listing_reports_select" ON public.merch_listing_reports;
CREATE POLICY "merch_listing_reports_select"
  ON public.merch_listing_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.merch_listings m WHERE m.id = merch_listing_id AND m.seller_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "merch_listing_reports_insert" ON public.merch_listing_reports;
CREATE POLICY "merch_listing_reports_insert"
  ON public.merch_listing_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- =============================================================================
-- 2) Auto-remove merch listing on 3 distinct reporters
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_remove_merch_listing_if_reported(p_merch_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_count
  FROM public.merch_listing_reports
  WHERE merch_listing_id = p_merch_listing_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_count, 0) < 3 THEN
    RETURN;
  END IF;

  UPDATE public.merch_listings
  SET status = 'removed'
  WHERE id = p_merch_listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merch_listing_reports_auto_remove_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_remove_merch_listing_if_reported(NEW.merch_listing_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merch_listing_reports_auto_remove ON public.merch_listing_reports;
CREATE TRIGGER merch_listing_reports_auto_remove
  AFTER INSERT ON public.merch_listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.merch_listing_reports_auto_remove_trigger();

-- =============================================================================
-- 3) Admin: merch listing reports with details
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_merch_listing_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY (r.resolved_at IS NOT NULL) ASC, r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      mlr.id,
      mlr.merch_listing_id,
      mlr.reporter_id,
      CASE WHEN mlr.reporter_id IS NULL THEN 'system' ELSE up_reporter.email END AS reporter_email,
      mlr.reported_by_username,
      mlr.reason,
      mlr.details,
      mlr.created_at,
      mlr.resolved_at,
      ml.seller_id AS seller_id,
      up_seller.email AS seller_email,
      ml.title,
      ml.status AS listing_status,
      ml.quantity,
      ml.price,
      ml.currency
    FROM public.merch_listing_reports mlr
    JOIN public.merch_listings ml ON ml.id = mlr.merch_listing_id
    LEFT JOIN public.user_profiles up_seller ON up_seller.id = ml.seller_id
    LEFT JOIN public.user_profiles up_reporter ON up_reporter.id = mlr.reporter_id
    WHERE public.is_admin()
  ) r;
$$;
GRANT EXECUTE ON FUNCTION public.admin_merch_listing_reports_with_details() TO authenticated;

-- =============================================================================
-- 4) Admin: set merch listing report resolved
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_merch_listing_report_resolved(p_report_id uuid, p_resolved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.merch_listing_reports
  SET resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END
  WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_merch_listing_report_resolved(uuid, boolean) TO authenticated;

-- =============================================================================
-- 5) Admin: remove merch listing (set status=removed, end any merch_connections)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_remove_merch_listing(p_merch_listing_id uuid, p_admin_message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_seller_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT seller_id INTO v_seller_id FROM public.merch_listings WHERE id = p_merch_listing_id;

  UPDATE public.merch_connections
  SET stage = 'ended', stage_expires_at = now()
  WHERE merch_listing_id = p_merch_listing_id
    AND stage NOT IN ('ended', 'expired', 'declined');

  UPDATE public.merch_listings
  SET status = 'removed'
  WHERE id = p_merch_listing_id;

  -- Optional: notify seller via user_notifications if we add a type later
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_remove_merch_listing(uuid, text) TO authenticated;

-- =============================================================================
-- 6) Admin: list merch listings (paged, filtered)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_merch_listings_paged_filtered(
  p_limit int,
  p_offset int,
  p_search text DEFAULT '',
  p_status text DEFAULT ''
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
  FROM public.merch_listings m
  LEFT JOIN public.user_profiles up ON up.id = m.seller_id
  WHERE (status_trim = '' OR m.status = status_trim)
    AND (
      search_trim = ''
      OR m.title ILIKE '%' || search_trim || '%'
      OR up.email ILIKE '%' || search_trim || '%'
    );

  SELECT json_agg(t) INTO rows
  FROM (
    SELECT
      m.id,
      m.title,
      m.status,
      m.quantity,
      m.price,
      m.currency,
      m.created_at,
      up.email AS seller_email
    FROM public.merch_listings m
    LEFT JOIN public.user_profiles up ON up.id = m.seller_id
    WHERE (status_trim = '' OR m.status = status_trim)
      AND (
        search_trim = ''
        OR m.title ILIKE '%' || search_trim || '%'
        OR up.email ILIKE '%' || search_trim || '%'
      )
    ORDER BY m.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;

  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_merch_listings_paged_filtered(int, int, text, text) TO authenticated;

-- =============================================================================
-- 7) public_stats: add merch_listings and merch_sold
-- =============================================================================
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'tickets', (
      SELECT count(*)::int FROM listings l
      WHERE l.status IN ('active', 'processing')
        AND l.processing_until <= now()
        AND l.locked_by IS NULL
    ),
    'events', (
      SELECT count(*)::int FROM (
        SELECT DISTINCT (l.concert_city || '|' || l.concert_date::text) AS k
        FROM listings l
        WHERE l.processing_until <= now() AND l.status <> 'removed'
      ) x
    ),
    'sold', (
      (SELECT count(*)::int FROM tickets t WHERE t.status = 'Sold')
      + (SELECT count(*)::int FROM listings l WHERE l.status = 'sold')
    ),
    'tickets_sold', (
      (SELECT COALESCE(SUM(t.quantity), 0)::int FROM tickets t WHERE t.status = 'Sold')
      + (SELECT count(*)::int FROM listing_seats ls JOIN listings l ON l.id = ls.listing_id WHERE l.status = 'sold')
    ),
    'merch_listings', (
      SELECT count(*)::int FROM merch_listings m
      WHERE m.status IN ('active', 'locked')
    ),
    'merch_sold', (
      SELECT count(*)::int FROM merch_listings m WHERE m.status = 'sold'
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_stats() TO authenticated;

-- =============================================================================
-- 8) admin_dashboard_stats: add merch_listings and merch_reports
-- =============================================================================
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
      'reports', (
        (SELECT count(*)::int FROM listing_reports)
        + (SELECT count(*)::int FROM user_reports)
      ),
      'banned', (SELECT count(*)::int FROM banned_users),
      'sellers', (SELECT count(*)::int FROM user_profiles up WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)),
      'buyers', (SELECT count(*)::int FROM (SELECT DISTINCT buyer_id AS id FROM connections) x),
      'merch_listings', (SELECT count(*)::int FROM merch_listings),
      'merch_reports', (SELECT count(*)::int FROM merch_listing_reports)
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
