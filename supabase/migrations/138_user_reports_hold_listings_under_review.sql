-- User reports: from first report, hold the reported user's listings under review (hidden from browse).
-- 3 reports = ban (existing). Admins can Release (listings visible again) or Remove and ban.

-- 1) Flag on user_profiles: when true, this user's listings are hidden from browse
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS listings_held_for_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.listings_held_for_review IS 'Set true when user has 1+ user report; listings hidden from browse until admin releases or user is banned.';

-- 2) Backfill: users who already have 1+ user report get held
UPDATE public.user_profiles up
SET listings_held_for_review = true
WHERE up.listings_held_for_review = false
  AND EXISTS (SELECT 1 FROM public.user_reports ur WHERE ur.reported_user_id = up.id);

-- 3) Trigger: on first (and any) user report, hold that user's listings
DROP TRIGGER IF EXISTS user_reports_hold_listings ON public.user_reports;
DROP FUNCTION IF EXISTS public.user_reports_hold_listings_trigger();

CREATE OR REPLACE FUNCTION public.user_reports_hold_listings_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET listings_held_for_review = true
  WHERE id = NEW.reported_user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_reports_hold_listings
  AFTER INSERT ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.user_reports_hold_listings_trigger();

-- 4) browse_listings: exclude listings whose seller has listings held for review
DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  status text,
  lock_expires_at timestamptz,
  vip boolean,
  loge boolean,
  seat_count int,
  seats json
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
    l.status,
    l.lock_expires_at,
    COALESCE(l.vip, false) AS vip,
    COALESCE(l.loge, false) AS loge,
    (SELECT count(*)::int FROM public.listing_seats WHERE listing_id = l.id) AS seat_count,
    (SELECT COALESCE(json_agg(
      json_build_object(
        'section', s2.section,
        'seat_row', s2.seat_row,
        'seat', s2.seat,
        'face_value_price', s2.face_value_price,
        'currency', COALESCE(s2.currency, 'USD')
      ) ORDER BY s2.seat_index
    ), '[]'::json) FROM public.listing_seats s2 WHERE s2.listing_id = l.id) AS seats
  FROM public.listings l
  INNER JOIN public.user_profiles up ON up.id = l.seller_id AND COALESCE(up.listings_held_for_review, false) = false
  WHERE l.status IN ('processing','active','locked','sold')
    AND (l.processing_until IS NULL OR l.processing_until <= now())
    AND l.status <> 'removed'
  ORDER BY
    CASE
      WHEN l.status = 'sold' THEN 2
      WHEN l.status = 'locked' THEN 1
      ELSE 0
    END ASC,
    l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.browse_listings() TO authenticated;

-- 5) Admin: list users under review (held due to user reports)
DROP FUNCTION IF EXISTS public.admin_users_under_review();
CREATE OR REPLACE FUNCTION public.admin_users_under_review()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(json_agg(t ORDER BY report_count DESC, reported_email), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      up.id AS user_id,
      up.email AS reported_email,
      (SELECT count(*)::int FROM public.user_reports ur WHERE ur.reported_user_id = up.id) AS report_count,
      (SELECT count(*)::int FROM public.listings ll WHERE ll.seller_id = up.id AND ll.status IN ('processing','active','locked','sold') AND ll.status <> 'removed') AS active_listing_count
    FROM public.user_profiles up
    WHERE up.listings_held_for_review = true
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_under_review() TO authenticated;

-- 6) Admin: release user's listings (listings visible again)
DROP FUNCTION IF EXISTS public.admin_release_user_listings(uuid);
CREATE OR REPLACE FUNCTION public.admin_release_user_listings(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.user_profiles
  SET listings_held_for_review = false
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_release_user_listings(uuid) TO authenticated;
