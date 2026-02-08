-- Atomic listing update: update listing row and replace seats in a single transaction.
-- Ensures we never leave a listing with 0 seats (avoids "only seat removed" bug when insert fails after delete).

CREATE OR REPLACE FUNCTION public.update_listing_with_seats(
  p_listing_id uuid,
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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_status text;
  v_seat jsonb;
  v_idx int := 0;
BEGIN
  -- Must be listing owner and listing must be editable
  SELECT l.seller_id, l.status
  INTO v_seller_id, v_status
  FROM public.listings l
  WHERE l.id = p_listing_id
  FOR UPDATE;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_seller_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_status IN ('sold', 'removed') THEN
    RAISE EXCEPTION 'Sold/removed listings cannot be edited';
  END IF;

  -- Require at least 1 seat, at most 4
  IF p_seats IS NULL OR jsonb_array_length(p_seats) < 1 OR jsonb_array_length(p_seats) > 4 THEN
    RAISE EXCEPTION 'Add between 1 and 4 seats';
  END IF;

  -- Update listing row (p_concert_date: YYYY-MM-DD text)
  UPDATE public.listings
  SET
    concert_city = p_concert_city,
    concert_date = (p_concert_date::date),
    ticket_source = p_ticket_source,
    ticketing_experience = p_ticketing_experience,
    selling_reason = p_selling_reason,
    price_explanation = NULLIF(trim(p_price_explanation), ''),
    vip = COALESCE(p_vip, false),
    loge = COALESCE(p_loge, false),
    suite = COALESCE(p_suite, false)
  WHERE id = p_listing_id;

  -- Replace seats (delete then insert in same transaction)
  DELETE FROM public.listing_seats
  WHERE listing_id = p_listing_id;

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
      p_listing_id,
      v_idx,
      trim(coalesce((v_seat->>'section'), '')),
      trim(coalesce((v_seat->>'row'), '')),
      trim(coalesce((v_seat->>'seat'), '')),
      GREATEST(0, COALESCE((v_seat->>'faceValuePrice')::numeric, 0)),
      coalesce(nullif(trim(v_seat->>'currency'), ''), 'USD')
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_listing_with_seats(uuid, text, text, text, text, text, text, boolean, boolean, boolean, jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_listing_with_seats IS 'Atomically update listing fields and replace all seats; prevents leaving listing with 0 seats.';
