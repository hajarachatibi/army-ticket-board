-- System duplicate reports: store reason='duplicate', details='Reported by the system: ...', show Reporter as "system".

-- 1) insert_listing_report_system: accept reason + optional details
DROP FUNCTION IF EXISTS public.insert_listing_report_system(uuid, text);
CREATE OR REPLACE FUNCTION public.insert_listing_report_system(p_listing_id uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.listing_reports (listing_id, reporter_id, reason, details)
  VALUES (p_listing_id, NULL, p_reason, p_details);
END;
$$;

-- 2) Duplicate seat trigger: call with reason='duplicate' and full phrase in details
DROP FUNCTION IF EXISTS public.listing_seats_duplicate_seat_trigger();
CREATE OR REPLACE FUNCTION public.listing_seats_duplicate_seat_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text;
  v_date date;
  v_norm_section text;
  v_norm_row text;
  v_norm_seat text;
  v_listing_ids uuid[];
  v_lid uuid;
BEGIN
  SELECT l.concert_city, l.concert_date
  INTO v_city, v_date
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  IF v_city IS NULL OR v_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_norm_section := public.normalize_seat_field(NEW.section);
  v_norm_row     := public.normalize_seat_field(NEW.seat_row);
  v_norm_seat    := public.normalize_seat_field(NEW.seat);

  SELECT array_agg(DISTINCT l.id)
  INTO v_listing_ids
  FROM public.listings l
  JOIN public.listing_seats s ON s.listing_id = l.id
  WHERE l.concert_city = v_city
    AND l.concert_date = v_date
    AND public.normalize_seat_field(s.section) = v_norm_section
    AND public.normalize_seat_field(s.seat_row) = v_norm_row
    AND public.normalize_seat_field(s.seat) = v_norm_seat;

  IF v_listing_ids IS NOT NULL AND array_length(v_listing_ids, 1) >= 2 THEN
    FOREACH v_lid IN ARRAY v_listing_ids
    LOOP
      PERFORM public.insert_listing_report_system(
        v_lid,
        'duplicate',
        'Reported by the system: duplicate seats (same show, date, city, and seat location).'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Backfill: existing system duplicate reports -> reason=duplicate, details=old reason
UPDATE public.listing_reports
SET
  details = reason,
  reason = 'duplicate'
WHERE reporter_id IS NULL
  AND reason LIKE 'Reported by the system: duplicate%';

-- 4) Admin listing reports: show "system" as reporter when reporter_id is null
DROP FUNCTION IF EXISTS public.admin_listing_reports_with_details();
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
      CASE WHEN lr.reporter_id IS NULL THEN 'system' ELSE up_reporter.email END AS reporter_email,
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
