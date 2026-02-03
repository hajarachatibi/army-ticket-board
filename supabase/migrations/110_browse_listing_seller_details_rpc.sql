-- Allow anyone viewing All Listings to fetch seller answers (ticketing experience, why sell, where bought).
-- Only for listings that are visible in browse (not removed).

DROP FUNCTION IF EXISTS public.get_browse_listing_seller_details(uuid);
CREATE OR REPLACE FUNCTION public.get_browse_listing_seller_details(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_ticket_source text;
  v_ticketing_experience text;
  v_selling_reason text;
BEGIN
  SELECT l.id, l.ticket_source, l.ticketing_experience, l.selling_reason
  INTO v_listing_id, v_ticket_source, v_ticketing_experience, v_selling_reason
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND l.status IN ('processing', 'active', 'locked', 'sold')
    AND l.status <> 'removed'
    AND (l.processing_until IS NULL OR l.processing_until <= now());

  IF v_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found or not available';
  END IF;

  RETURN json_build_object(
    'ticketSource', COALESCE(v_ticket_source, ''),
    'ticketingExperience', COALESCE(v_ticketing_experience, ''),
    'sellingReason', COALESCE(v_selling_reason, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_browse_listing_seller_details(uuid) TO authenticated;
