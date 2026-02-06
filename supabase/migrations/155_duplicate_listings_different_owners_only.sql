-- 1) System duplicate reports: only create when the duplicate listings belong to DIFFERENT users.
--    If the same user has multiple listings with the same seat, do not create a system report.
-- 2) Prevent same-user duplicate: when a user adds/updates a seat that duplicates one of their
--    own existing listings (same city, date, section, row, seat), block with a clear message.

-- Duplicate seat trigger: only report when at least 2 distinct owners
DROP TRIGGER IF EXISTS listing_seats_check_duplicate_seat ON public.listing_seats;
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
  v_distinct_sellers int;
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

  IF v_listing_ids IS NULL OR array_length(v_listing_ids, 1) < 2 THEN
    RETURN NEW;
  END IF;

  -- Only create system duplicate reports when the duplicate set involves different owners
  SELECT count(DISTINCT l.seller_id)::int
  INTO v_distinct_sellers
  FROM public.listings l
  WHERE l.id = ANY(v_listing_ids);

  IF v_distinct_sellers < 2 THEN
    RETURN NEW;
  END IF;

  FOREACH v_lid IN ARRAY v_listing_ids
  LOOP
    PERFORM public.insert_listing_report_system(
      v_lid,
      'duplicate',
      'Reported by the system: duplicate seats (same show, date, city, and seat location).'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_seats_check_duplicate_seat
  AFTER INSERT OR UPDATE OF section, seat_row, seat ON public.listing_seats
  FOR EACH ROW EXECUTE FUNCTION public.listing_seats_duplicate_seat_trigger();

-- Prevent same-user duplicate: block insert/update if this seat already exists on another listing of the same seller
CREATE OR REPLACE FUNCTION public.listing_seats_prevent_same_user_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_city text;
  v_date date;
  v_norm_section text;
  v_norm_row text;
  v_norm_seat text;
BEGIN
  SELECT l.seller_id, l.concert_city, l.concert_date
  INTO v_seller_id, v_city, v_date
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  IF v_seller_id IS NULL OR v_city IS NULL OR v_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_norm_section := public.normalize_seat_field(NEW.section);
  v_norm_row     := public.normalize_seat_field(NEW.seat_row);
  v_norm_seat    := public.normalize_seat_field(NEW.seat);

  IF EXISTS (
    SELECT 1
    FROM public.listings l2
    JOIN public.listing_seats s2 ON s2.listing_id = l2.id
    WHERE l2.seller_id = v_seller_id
      AND l2.id <> NEW.listing_id
      AND l2.concert_city = v_city
      AND l2.concert_date = v_date
      AND public.normalize_seat_field(s2.section) = v_norm_section
      AND public.normalize_seat_field(s2.seat_row) = v_norm_row
      AND public.normalize_seat_field(s2.seat) = v_norm_seat
  ) THEN
    RAISE EXCEPTION 'The listing you are trying to create already exists, under your listings, please remove first or update the existing one.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_seats_prevent_same_user_duplicate ON public.listing_seats;
CREATE TRIGGER listing_seats_prevent_same_user_duplicate
  BEFORE INSERT OR UPDATE OF section, seat_row, seat ON public.listing_seats
  FOR EACH ROW EXECUTE FUNCTION public.listing_seats_prevent_same_user_duplicate();
