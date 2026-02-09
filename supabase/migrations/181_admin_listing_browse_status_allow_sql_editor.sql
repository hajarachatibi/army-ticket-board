-- Allow admin_listing_browse_status to run from SQL Editor (no JWT) or as admin.
-- In Supabase SQL Editor, auth.uid() is null so is_admin() is false; allow when uid is null.

CREATE OR REPLACE FUNCTION public.admin_listing_browse_status(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_status text;
  v_processing_until timestamptz;
  v_seller_id uuid;
  v_held boolean;
  v_reason text := '';
  v_would_show boolean := true;
BEGIN
  IF public.is_admin() OR auth.uid() IS NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT l.id, l.status, l.processing_until, l.seller_id
  INTO v_listing_id, v_status, v_processing_until, v_seller_id
  FROM public.listings l
  WHERE l.id = p_listing_id;

  IF v_listing_id IS NULL THEN
    RETURN json_build_object('found', false, 'would_show', false, 'reason', 'Listing not found');
  END IF;

  IF v_status NOT IN ('processing', 'active', 'locked', 'sold') THEN
    v_would_show := false;
    v_reason := 'Status is ' || COALESCE(v_status, 'null') || ' (must be processing, active, locked, or sold)';
  END IF;

  IF v_would_show AND v_processing_until IS NOT NULL AND v_processing_until > now() THEN
    v_would_show := false;
    v_reason := 'processing_until is in the future (listing still in processing window). Run backfill or wait.';
  END IF;

  SELECT COALESCE(up.listings_held_for_review, false) INTO v_held
  FROM public.user_profiles up WHERE up.id = v_seller_id;

  IF v_would_show AND v_held THEN
    v_would_show := false;
    v_reason := 'Seller has listings_held_for_review = true. Admin must release this user (Admin > Users Under Review > Release listings).';
  END IF;

  RETURN json_build_object(
    'found', true,
    'would_show', v_would_show,
    'reason', CASE WHEN v_reason <> '' THEN v_reason ELSE NULL END,
    'status', v_status,
    'processing_until', v_processing_until,
    'processing_until_passed', v_processing_until IS NULL OR v_processing_until <= now(),
    'seller_held_for_review', COALESCE(v_held, false)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_listing_browse_status(uuid) IS 'Diagnose why a listing does or does not appear in All Listings. Allowed: admin or when run from SQL Editor (auth.uid() null).';
