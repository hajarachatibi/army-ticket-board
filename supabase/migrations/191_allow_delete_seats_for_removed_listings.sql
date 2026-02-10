-- Allow deleting all seats when a listing is being removed / deleted,
-- while still preventing zero-seat *active* listings.
-- Fixes cases like admin/system ban flows that remove listings.

CREATE OR REPLACE FUNCTION public.listing_seats_require_at_least_one()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_replacing_listing_id text;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- When update_listing_with_seats replaces seats it deletes all then inserts new ones.
    -- Skip the check for that listing so the atomic replace can complete.
    v_replacing_listing_id := current_setting('app.replacing_listing_seats', true);
    IF v_replacing_listing_id IS NOT NULL
       AND v_replacing_listing_id <> ''
       AND v_replacing_listing_id = OLD.listing_id::text THEN
      RETURN OLD;
    END IF;

    -- If the parent listing is already gone or marked removed, allow deleting seats.
    SELECT l.status
    INTO v_status
    FROM public.listings l
    WHERE l.id = OLD.listing_id;

    -- No parent row found (listing being deleted) or already removed -> allow delete.
    IF v_status IS NULL OR v_status = 'removed' THEN
      RETURN OLD;
    END IF;

    -- For active listings, still enforce "at least one seat".
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

