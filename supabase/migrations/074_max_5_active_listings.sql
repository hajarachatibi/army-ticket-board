-- Enforce max 5 active listings per seller (processing/active/locked).

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
  IF v_seller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize per seller to avoid race conditions.
  PERFORM pg_advisory_xact_lock(hashtext(v_seller::text));

  SELECT count(*) INTO v_count
  FROM public.listings l
  WHERE l.seller_id = v_seller
    AND l.status IN ('processing','active','locked')
    AND (TG_OP <> 'UPDATE' OR l.id <> OLD.id);

  -- Only enforce when the new row is active-ish.
  IF NEW.status IN ('processing','active','locked') AND COALESCE(v_count, 0) >= 5 THEN
    RAISE EXCEPTION 'Max 5 active listings allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_max_active ON public.listings;
CREATE TRIGGER listings_enforce_max_active
  BEFORE INSERT OR UPDATE OF status, seller_id ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_active_listings();

