-- Create listing and seats in a single transaction so we never end up with a listing that has 0 seats.
-- If seat insert fails (e.g. duplicate trigger), the listing insert is rolled back.

CREATE OR REPLACE FUNCTION public.create_listing_with_seats(
  p_concert_city text,
  p_concert_date text,
  p_ticket_source text,
  p_ticketing_experience text,
  p_selling_reason text,
  p_price_explanation text,
  p_vip boolean,
  p_loge boolean,
  p_suite boolean,
  p_seats jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_listing_id uuid;
  v_seat jsonb;
  v_idx int := 0;
BEGIN
  v_seller_id := auth.uid();
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Require at least 1 seat, at most 4
  IF p_seats IS NULL OR jsonb_array_length(p_seats) < 1 OR jsonb_array_length(p_seats) > 4 THEN
    RAISE EXCEPTION 'Add between 1 and 4 seats';
  END IF;

  -- Insert listing row (triggers e.g. enforce_max_active_listings will run)
  INSERT INTO public.listings (
    seller_id,
    concert_city,
    concert_date,
    ticket_source,
    ticketing_experience,
    selling_reason,
    price_explanation,
    vip,
    loge,
    suite,
    status,
    processing_until
  ) VALUES (
    v_seller_id,
    trim(p_concert_city),
    (p_concert_date::date),
    trim(p_ticket_source),
    trim(p_ticketing_experience),
    trim(p_selling_reason),
    NULLIF(trim(p_price_explanation), ''),
    COALESCE(p_vip, false),
    COALESCE(p_loge, false),
    COALESCE(p_suite, false),
    'active',
    now()
  )
  RETURNING id INTO v_listing_id;

  -- Insert seats (duplicate trigger may raise; then whole transaction rolls back)
  FOR v_seat IN SELECT * FROM jsonb_array_elements(p_seats)
  LOOP
    v_idx := v_idx + 1;
    IF v_idx > 4 THEN
      RAISE EXCEPTION 'Maximum 4 seats per listing';
    END IF;
    IF trim(coalesce((v_seat->>'section'), '')) = '' OR trim(coalesce((v_seat->>'row'), '')) = '' OR trim(coalesce((v_seat->>'seat'), '')) = '' THEN
      RAISE EXCEPTION 'Each seat needs section, row, seat';
    END IF;
    IF (COALESCE((v_seat->>'faceValuePrice')::numeric, 0) <= 0) THEN
      RAISE EXCEPTION 'Each seat needs a face value price';
    END IF;
    INSERT INTO public.listing_seats (
      listing_id,
      seat_index,
      section,
      seat_row,
      seat,
      face_value_price,
      currency
    ) VALUES (
      v_listing_id,
      v_idx,
      trim(coalesce((v_seat->>'section'), '')),
      trim(coalesce((v_seat->>'row'), '')),
      trim(coalesce((v_seat->>'seat'), '')),
      GREATEST(0, COALESCE((v_seat->>'faceValuePrice')::numeric, 0)),
      coalesce(nullif(trim(v_seat->>'currency'), ''), 'USD')
    );
  END LOOP;

  RETURN v_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_listing_with_seats(text, text, text, text, text, text, boolean, boolean, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_listing_with_seats IS 'Create listing and seats in one transaction; prevents listing with 0 seats if seat insert fails.';
