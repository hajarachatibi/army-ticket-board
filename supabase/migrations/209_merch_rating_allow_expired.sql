-- Allow buyer to rate seller when connection is expired (same as ended).
CREATE OR REPLACE FUNCTION public.submit_merch_connection_rating(p_connection_id uuid, p_rating smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO v
  FROM public.merch_connections
  WHERE id = p_connection_id;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can rate the seller'; END IF;
  IF v.stage NOT IN ('chat_open', 'ended', 'expired') THEN
    RAISE EXCEPTION 'Connection must be completed before rating';
  END IF;

  INSERT INTO public.merch_connection_ratings (merch_connection_id, rater_id, rated_id, rating)
  VALUES (p_connection_id, v.buyer_id, v.seller_id, p_rating)
  ON CONFLICT (merch_connection_id, rater_id) DO UPDATE SET rating = EXCLUDED.rating, created_at = now();
END;
$$;
