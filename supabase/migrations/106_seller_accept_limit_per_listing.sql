-- Fix: seller can accept only one active connection PER LISTING (not across all listings).

CREATE OR REPLACE FUNCTION public.seller_respond_connection(p_connection_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_q uuid[];
  v_active int;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF v.seller_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v.stage <> 'pending_seller' THEN
    RAISE EXCEPTION 'Connection not in pending state';
  END IF;

  IF now() > v.stage_expires_at THEN
    RAISE EXCEPTION 'Connection expired';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.connections
    SET stage = 'declined',
        stage_expires_at = now()
    WHERE id = p_connection_id;
    RETURN;
  END IF;

  -- Per listing: seller can accept only ONE active connection at a time for this listing.
  -- Lock on listing_id to prevent two parallel accepts on the same listing.
  PERFORM pg_advisory_xact_lock(hashtext(v.listing_id::text));
  SELECT count(*) INTO v_active
  FROM public.connections c
  WHERE c.listing_id = v.listing_id
    AND c.seller_id = auth.uid()
    AND c.id <> p_connection_id
    AND c.stage IN ('bonding','preview','comfort','social','agreement','chat_open');

  IF COALESCE(v_active, 0) > 0 THEN
    RAISE EXCEPTION 'This listing already has an active connection. End or finish it before accepting another request for this listing.';
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = v.listing_id
  FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_listing.status IN ('sold','removed') THEN
    RAISE EXCEPTION 'Listing not available';
  END IF;

  IF v_listing.locked_by IS NOT NULL OR v_listing.status = 'locked' THEN
    RAISE EXCEPTION 'Listing already locked';
  END IF;

  UPDATE public.listings
  SET status = 'locked',
      locked_by = v.buyer_id,
      locked_at = now(),
      lock_expires_at = now() + interval '24 hours'
  WHERE id = v.listing_id;

  SELECT array_agg(id) INTO v_q
  FROM (
    SELECT id
    FROM public.bonding_questions
    WHERE active = true
    ORDER BY random()
    LIMIT 3
  ) s;

  UPDATE public.connections
  SET stage = 'bonding',
      stage_expires_at = now() + interval '24 hours',
      bonding_question_ids = COALESCE(v_q, '{}'::uuid[])
  WHERE id = p_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_respond_connection(uuid, boolean) TO authenticated;

