-- 1) Include vip and lounge in connection_listing_details (view details).
-- 2) Do not skip 3-reports removal for lounge; apply same rule to all listing types.

-- 1) connection_listing_details: add vip and lounge to listing object
DROP FUNCTION IF EXISTS public.connection_listing_details(uuid);
CREATE OR REPLACE FUNCTION public.connection_listing_details(p_connection_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_listing json;
  v_seats json;
BEGIN
  SELECT * INTO v
  FROM public.connections c
  WHERE c.id = p_connection_id;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT json_build_object(
    'id', l.id,
    'concert_city', l.concert_city,
    'concert_date', l.concert_date,
    'ticket_source', l.ticket_source,
    'ticketing_experience', l.ticketing_experience,
    'selling_reason', l.selling_reason,
    'price_explanation', l.price_explanation,
    'status', l.status,
    'created_at', l.created_at,
    'vip', COALESCE(l.vip, false),
    'lounge', COALESCE(l.lounge, false)
  )
  INTO v_listing
  FROM public.listings l
  WHERE l.id = v.listing_id;

  IF v_listing IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(json_agg(s ORDER BY s.seat_index ASC), '[]'::json)
  INTO v_seats
  FROM (
    SELECT seat_index, section, seat_row, seat, face_value_price, currency
    FROM public.listing_seats
    WHERE listing_id = v.listing_id
    ORDER BY seat_index ASC
  ) s;

  RETURN json_build_object('listing', v_listing, 'seats', v_seats);
END;
$$;

GRANT EXECUTE ON FUNCTION public.connection_listing_details(uuid) TO authenticated;

-- 2) Apply 3-reports removal to all listing types (no lounge exemption)
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
  -- 3 distinct reporters for "Not face value" → remove.
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
