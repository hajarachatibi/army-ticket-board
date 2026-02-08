-- Loge listings: use 3 reports for face value (and other reasons), same as Standard/VIP/Suite.
-- Previously Loge required 7; now all listing types use threshold 3.

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
BEGIN
  -- All listing types (Standard, VIP, Loge, Suite): 3 distinct reporters to remove.
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

  IF COALESCE(v_other_count, 0) >= 3 THEN
    v_remove := true;
    v_report_count := 3;
  ELSIF COALESCE(v_face_value_count, 0) >= 3 THEN
    v_remove := true;
    v_report_count := v_face_value_count;
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
