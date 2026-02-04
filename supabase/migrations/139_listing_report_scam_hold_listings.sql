-- When a listing is reported with a scam reason, hold that seller's listings under review
-- (same behavior as user reports: hidden from browse until admin releases or user is banned).

-- 1) Trigger: on listing report insert with scam reason, set seller's listings_held_for_review = true
DROP TRIGGER IF EXISTS listing_reports_scam_hold_listings ON public.listing_reports;
DROP FUNCTION IF EXISTS public.listing_reports_scam_hold_listings_trigger();

CREATE OR REPLACE FUNCTION public.listing_reports_scam_hold_listings_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  IF public.is_scam_reason(NEW.reason) <> true THEN
    RETURN NEW;
  END IF;

  SELECT l.seller_id INTO v_seller_id
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  IF v_seller_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET listings_held_for_review = true
    WHERE id = v_seller_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_reports_scam_hold_listings
  AFTER INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.listing_reports_scam_hold_listings_trigger();

-- 2) Backfill: sellers who have at least one listing report with scam reason get held
UPDATE public.user_profiles up
SET listings_held_for_review = true
WHERE up.listings_held_for_review = false
  AND EXISTS (
    SELECT 1
    FROM public.listing_reports lr
    JOIN public.listings l ON l.id = lr.listing_id
    WHERE l.seller_id = up.id
      AND public.is_scam_reason(lr.reason) = true
  );
