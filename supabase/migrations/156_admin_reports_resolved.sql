-- Add resolved state to user reports and listing reports. Admins can mark reports as resolved;
-- resolved reports appear at the bottom of the list to avoid double work.

-- 1) user_reports: add resolved_at
ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL;

-- 2) listing_reports: add resolved_at
ALTER TABLE public.listing_reports
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL;

-- 3) Admin: set user report resolved (true = resolved, false = unresolved)
CREATE OR REPLACE FUNCTION public.admin_set_user_report_resolved(p_report_id uuid, p_resolved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.user_reports
  SET resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END
  WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_user_report_resolved(uuid, boolean) TO authenticated;

-- 4) Admin: set listing report resolved (true = resolved, false = unresolved)
CREATE OR REPLACE FUNCTION public.admin_set_listing_report_resolved(p_report_id uuid, p_resolved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.listing_reports
  SET resolved_at = CASE WHEN p_resolved THEN now() ELSE NULL END
  WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_listing_report_resolved(uuid, boolean) TO authenticated;

-- 5) admin_user_reports_with_details: include resolved_at, order unresolved first then by created_at DESC
DROP FUNCTION IF EXISTS public.admin_user_reports_with_details();
CREATE OR REPLACE FUNCTION public.admin_user_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY (r.resolved_at IS NOT NULL) ASC, r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      ur.id,
      ur.reported_user_id,
      up_reported.email AS reported_email,
      ur.reporter_id,
      up_reporter.email AS reporter_email,
      ur.reported_by_username,
      ur.reason,
      ur.details,
      ur.image_url,
      ur.created_at,
      ur.resolved_at
    FROM public.user_reports ur
    LEFT JOIN public.user_profiles up_reported ON up_reported.id = ur.reported_user_id
    LEFT JOIN public.user_profiles up_reporter ON up_reporter.id = ur.reporter_id
    WHERE EXISTS (SELECT 1 FROM public.user_profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
  ) r;
$$;
GRANT EXECUTE ON FUNCTION public.admin_user_reports_with_details() TO authenticated;

-- 6) admin_listing_reports_with_details: include resolved_at, order unresolved first then by created_at DESC
DROP FUNCTION IF EXISTS public.admin_listing_reports_with_details();
CREATE OR REPLACE FUNCTION public.admin_listing_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY (r.resolved_at IS NOT NULL) ASC, r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      lr.id,
      lr.listing_id,
      lr.reporter_id,
      CASE WHEN lr.reporter_id IS NULL THEN 'system' ELSE up_reporter.email END AS reporter_email,
      lr.reported_by_username,
      lr.reason,
      lr.details,
      lr.created_at,
      lr.resolved_at,
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
  ) r;
$$;
GRANT EXECUTE ON FUNCTION public.admin_listing_reports_with_details() TO authenticated;
