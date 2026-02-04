-- Add Lounge as a listing type (Standard, VIP, Lounge).
-- Lounge listings skip the 3-reports removal rule (expensive tickets).

-- 1) Add lounge column to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS lounge boolean NOT NULL DEFAULT false;

-- 2) Expose lounge in browse_listings
DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  status text,
  lock_expires_at timestamptz,
  vip boolean,
  lounge boolean,
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
    COALESCE(l.lounge, false) AS lounge,
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

-- 3) Skip 3-reports removal for lounge listings (expensive tickets)
CREATE OR REPLACE FUNCTION public.auto_enforce_listing_reports(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_face_value_count int;
  v_other_count int;
  v_remove boolean := false;
  v_report_count int := 3;
  v_owner_id uuid;
  v_summary text;
  v_reasons text;
  v_scam_count int;
  v_lounge boolean;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_face_value_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL
    AND public.is_face_value_reason(reason);

  SELECT count(DISTINCT reporter_id) INTO v_other_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL
    AND NOT public.is_face_value_reason(reason);

  -- 3 distinct reporters for other reasons (scam, suspicious, harassment, other) → remove.
  IF COALESCE(v_other_count, 0) >= 3 THEN
    v_remove := true;
    v_report_count := 3;
  -- 3 distinct reporters for "Not face value" → remove (was 7, now 3).
  ELSIF COALESCE(v_face_value_count, 0) >= 3 THEN
    v_remove := true;
    v_report_count := v_face_value_count;
  END IF;

  -- Lounge listings skip the 3-reports removal rule (expensive tickets).
  IF v_remove THEN
    SELECT COALESCE(l.lounge, false) INTO v_lounge
    FROM public.listings l
    WHERE l.id = p_listing_id;
    IF v_lounge THEN
      v_remove := false;
    END IF;
  END IF;

  IF v_remove THEN
    SELECT l.seller_id,
           trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
      INTO v_owner_id, v_summary
      FROM public.listings l
      WHERE l.id = p_listing_id;

    SELECT string_agg(reason, ', ' ORDER BY reason)
      INTO v_reasons
      FROM (SELECT DISTINCT reason FROM public.listing_reports
            WHERE listing_id = p_listing_id
              AND reason IS NOT NULL AND trim(reason) <> '') s(reason);

    UPDATE public.listings
    SET status = 'removed',
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = p_listing_id;

    IF v_owner_id IS NOT NULL THEN
      PERFORM public.notify_listing_removed_3_reports(
        v_owner_id,
        p_listing_id,
        COALESCE(v_summary, 'Listing'),
        COALESCE(v_reasons, 'Reported'),
        v_report_count
      );
    END IF;
  END IF;

  SELECT seller_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  PERFORM public.auto_ban_owner_if_scam_reports(v_owner_id);

  SELECT count(DISTINCT reporter_id) INTO v_scam_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL
    AND public.is_scam_reason(reason) = true;

  IF COALESCE(v_scam_count, 0) < 3 THEN
    RETURN;
  END IF;

  PERFORM public.auto_ban_owner_if_scam_reports(v_owner_id);
END;
$$;
