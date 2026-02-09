-- 1) No zero-seat listings: prevent deleting the last seat from a listing.
CREATE OR REPLACE FUNCTION public.listing_seats_require_at_least_one()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO v_count
    FROM public.listing_seats
    WHERE listing_id = OLD.listing_id;
    IF v_count <= 1 THEN
      RAISE EXCEPTION 'A listing must have at least one seat';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS listing_seats_require_at_least_one ON public.listing_seats;
CREATE TRIGGER listing_seats_require_at_least_one
  BEFORE DELETE ON public.listing_seats
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_seats_require_at_least_one();
