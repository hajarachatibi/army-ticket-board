-- Duplicate error (same user, same seat) should only apply when the existing listing
-- is not sold and not removed. So users can re-post the same seats after selling or removing.

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

  -- Only block if the same user has another listing (same city, date, seat) that is NOT sold and NOT removed.
  IF EXISTS (
    SELECT 1
    FROM public.listings l2
    JOIN public.listing_seats s2 ON s2.listing_id = l2.id
    WHERE l2.seller_id = v_seller_id
      AND l2.id <> NEW.listing_id
      AND l2.concert_city = v_city
      AND l2.concert_date = v_date
      AND l2.status NOT IN ('sold', 'removed')
      AND public.normalize_seat_field(s2.section) = v_norm_section
      AND public.normalize_seat_field(s2.seat_row) = v_norm_row
      AND public.normalize_seat_field(s2.seat) = v_norm_seat
  ) THEN
    RAISE EXCEPTION 'The listing you are trying to create already exists, under your listings, please remove first or update the existing one.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists; no need to recreate unless dropped.
-- DROP TRIGGER IF EXISTS listing_seats_prevent_same_user_duplicate ON public.listing_seats;
-- CREATE TRIGGER listing_seats_prevent_same_user_duplicate ...
