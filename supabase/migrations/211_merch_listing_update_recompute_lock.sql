-- When a merch listing is updated (e.g. quantity increased), recompute lock so it can
-- automatically unlock if active_connections < 3 * new_quantity.
CREATE OR REPLACE FUNCTION public.merch_listings_after_update_recompute_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('sold', 'removed') THEN
    RETURN NEW;
  END IF;
  IF OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recompute_merch_listing_lock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merch_listings_after_update_recompute_lock ON public.merch_listings;
CREATE TRIGGER merch_listings_after_update_recompute_lock
  AFTER UPDATE ON public.merch_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.merch_listings_after_update_recompute_lock();

COMMENT ON FUNCTION public.merch_listings_after_update_recompute_lock() IS 'Recomputes lock when quantity or status changes so e.g. increasing quantity can unlock the listing.';
