-- Listing limit: max 3 non-removed and non-sold listings per seller.
-- Sold and removed listings no longer count toward the limit.

DROP TRIGGER IF EXISTS listings_enforce_max_active ON public.listings;
DROP FUNCTION IF EXISTS public.enforce_max_active_listings();
CREATE OR REPLACE FUNCTION public.enforce_max_active_listings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_count int;
BEGIN
  v_seller := COALESCE(NEW.seller_id, OLD.seller_id);
  IF v_seller IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_seller::text));
  -- Count only processing, active, locked (exclude sold and removed).
  SELECT count(*) INTO v_count
  FROM public.listings l
  WHERE l.seller_id = v_seller
    AND l.status IN ('processing','active','locked')
    AND (TG_OP <> 'UPDATE' OR l.id <> OLD.id);
  IF NEW.status IN ('processing','active','locked') AND COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You can have at most 3 active listings at a time (sold and removed do not count). Mark one sold, delete one, or wait for one to complete.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listings_enforce_max_active
  BEFORE INSERT OR UPDATE OF status, seller_id ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_active_listings();
