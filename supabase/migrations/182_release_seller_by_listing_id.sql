-- Release a listing's seller from "held for review" by listing ID (for use in SQL Editor or by admin).
-- Useful when admin_listing_browse_status shows seller_held_for_review and you want to fix by listing.

CREATE OR REPLACE FUNCTION public.admin_release_seller_by_listing_id(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_updated int;
BEGIN
  IF public.is_admin() OR auth.uid() IS NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT seller_id INTO v_seller_id FROM public.listings WHERE id = p_listing_id;
  IF v_seller_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found');
  END IF;

  UPDATE public.user_profiles
  SET listings_held_for_review = false
  WHERE id = v_seller_id AND (listings_held_for_review = true OR listings_held_for_review IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN json_build_object(
    'ok', true,
    'listing_id', p_listing_id,
    'seller_id', v_seller_id,
    'released', v_updated > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_release_seller_by_listing_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.admin_release_seller_by_listing_id(uuid) IS 'Set listings_held_for_review = false for the seller of this listing. Allowed: admin or SQL Editor (auth.uid() null).';
