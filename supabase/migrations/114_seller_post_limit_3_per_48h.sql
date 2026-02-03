-- Increase posting limit: max 3 listings per 48 hours (was 2).

DROP TRIGGER IF EXISTS listings_enforce_post_limit_48h ON public.listings;
DROP FUNCTION IF EXISTS public.enforce_seller_post_limit_48h();

CREATE OR REPLACE FUNCTION public.enforce_seller_post_limit_48h()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.seller_id::text));

  SELECT count(*) INTO v_count
  FROM public.listings l
  WHERE l.seller_id = NEW.seller_id
    AND l.created_at > now() - interval '48 hours';

  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You can only post 3 listings within 48 hours';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_enforce_post_limit_48h
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seller_post_limit_48h();
