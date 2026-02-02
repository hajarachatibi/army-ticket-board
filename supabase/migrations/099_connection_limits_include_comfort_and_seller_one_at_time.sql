-- Connection limits hardening:
-- 1) Count 'comfort' as active stage for buyer max-3 logic (trigger + connect_to_listing guard + uniq index + end_connection).
-- 2) Seller can accept only one active connection at a time (across all listings).

-- 1) Helpful index: prevent duplicate active request per listing+buyer (include comfort).
DROP INDEX IF EXISTS public.uniq_connections_one_active_request_per_listing_buyer;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_connections_one_active_request_per_listing_buyer
  ON public.connections(listing_id, buyer_id)
  WHERE stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

-- 2) Buyer max 3 active connections/requests (include comfort).
DROP TRIGGER IF EXISTS connections_enforce_max_active_buyer ON public.connections;
DROP FUNCTION IF EXISTS public.enforce_max_active_connections_per_buyer();
CREATE OR REPLACE FUNCTION public.enforce_max_active_connections_per_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_buyer uuid;
BEGIN
  v_buyer := COALESCE(NEW.buyer_id, OLD.buyer_id);
  IF v_buyer IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_buyer::text));

  SELECT count(*) INTO v_count
  FROM public.connections c
  WHERE c.buyer_id = v_buyer
    AND c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open')
    AND (TG_OP <> 'UPDATE' OR c.id <> NEW.id);

  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You can only have up to 3 active connection requests at a time';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER connections_enforce_max_active_buyer
  BEFORE INSERT OR UPDATE OF stage, buyer_id ON public.connections
  FOR EACH ROW
  WHEN (NEW.stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open'))
  EXECUTE FUNCTION public.enforce_max_active_connections_per_buyer();

-- 3) Buyer requests: connect_to_listing() guard includes comfort stage.
CREATE OR REPLACE FUNCTION public.connect_to_listing(p_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_connection_id uuid;
  v_count int;
BEGIN
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_listing.status IN ('sold','removed') THEN
    RAISE EXCEPTION 'Listing not available';
  END IF;

  IF now() < v_listing.processing_until THEN
    RAISE EXCEPTION 'Listing is still processing';
  END IF;

  IF v_listing.locked_by IS NOT NULL OR v_listing.status = 'locked' THEN
    RAISE EXCEPTION 'Listing already locked';
  END IF;

  IF v_listing.seller_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot connect to your own listing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL
      AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.connections c
  WHERE c.buyer_id = auth.uid()
    AND c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');
  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You already have 3 active connection requests';
  END IF;

  INSERT INTO public.connections (listing_id, buyer_id, seller_id, stage, stage_expires_at)
  VALUES (p_listing_id, auth.uid(), v_listing.seller_id, 'pending_seller', now() + interval '24 hours')
  RETURNING id INTO v_connection_id;

  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_listing(uuid) TO authenticated;

-- 4) Seller response: accept is limited to one active accepted connection at a time.
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

  -- Seller can accept only one active connection at a time.
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
  SELECT count(*) INTO v_active
  FROM public.connections c
  WHERE c.seller_id = auth.uid()
    AND c.id <> p_connection_id
    AND c.stage IN ('bonding','preview','comfort','social','agreement','chat_open');

  IF COALESCE(v_active, 0) > 0 THEN
    RAISE EXCEPTION 'You already have an active connection. End or finish it before accepting another request.';
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

-- 5) End/release connection: include comfort stage.
CREATE OR REPLACE FUNCTION public.end_connection(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  UPDATE public.connections
  SET stage = 'ended',
      stage_expires_at = now()
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE l.id = v.listing_id
    AND l.status = 'locked'
    AND l.locked_by = v.buyer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_connection(uuid) TO authenticated;

