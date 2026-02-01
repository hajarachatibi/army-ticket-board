-- Connection requests:
-- - Allow multiple buyer requests per listing (seller can see all).
-- - Buyer can have max 3 active requests/connections at a time.
-- - Listing locks ONLY when seller accepts (not when buyer requests).
-- - Either side can end/release the connection; if it was the locked one, listing unlocks.

-- 1) Allow multiple connections per listing (drop UNIQUE constraint on connections.listing_id)
ALTER TABLE public.connections
  DROP CONSTRAINT IF EXISTS connections_listing_id_key;

-- Helpful index to avoid duplicate active requests by same buyer for same listing.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_connections_one_active_request_per_listing_buyer
  ON public.connections(listing_id, buyer_id)
  WHERE stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');

-- 2) Buyer max 3 active connections/requests (trigger-based, concurrency-safe)
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
    AND c.stage IN ('pending_seller','bonding','preview','social','agreement','chat_open')
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
  WHEN (NEW.stage IN ('pending_seller','bonding','preview','social','agreement','chat_open'))
  EXECUTE FUNCTION public.enforce_max_active_connections_per_buyer();

-- 3) Buyer requests: connect_to_listing() now creates a request ONLY (no lock).
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

  -- If locked, buyer cannot request it (seller already matched someone).
  IF v_listing.locked_by IS NOT NULL OR v_listing.status = 'locked' THEN
    RAISE EXCEPTION 'Listing already locked';
  END IF;

  IF v_listing.seller_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot connect to your own listing';
  END IF;

  -- Ensure buyer has onboarding completed and terms accepted.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL
      AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  -- Clear message (trigger also enforces).
  SELECT count(*) INTO v_count
  FROM public.connections c
  WHERE c.buyer_id = auth.uid()
    AND c.stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');
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

-- 4) Seller response: accept locks listing; decline only updates the request.
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

  -- Accept: lock listing (only if not already locked/sold/removed).
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

-- 5) End/release connection (buyer or seller). Unlocks listing ONLY if this connection owns the lock.
DROP FUNCTION IF EXISTS public.end_connection(uuid);
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
    AND stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');

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

-- 6) Make existing timeouts safe with multiple requests:
-- Only unlock listing if the expired connection matches listing.locked_by.
CREATE OR REPLACE FUNCTION public.process_connection_timeouts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH expired AS (
    UPDATE public.connections c
    SET stage = 'expired',
        stage_expires_at = now()
    WHERE c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement')
      AND c.stage_expires_at < now()
    RETURNING c.listing_id, c.buyer_id
  )
  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE (l.id, l.locked_by) IN (SELECT listing_id, buyer_id FROM expired)
    AND l.status = 'locked';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_connection_timeouts() TO authenticated;

-- 7) Inactive connection chats: only unlock if lock matches buyer.
CREATE OR REPLACE FUNCTION public.process_inactive_connection_chats()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH stale AS (
    SELECT c.connection_id, c.listing_id, c.id AS chat_id
    FROM public.chats c
    WHERE c.connection_id IS NOT NULL
      AND c.status = 'open'
      AND c.last_message_at < now() - interval '24 hours'
  ),
  closed AS (
    UPDATE public.chats c
    SET status = 'closed',
        closed_at = now()
    WHERE c.id IN (SELECT chat_id FROM stale)
    RETURNING c.connection_id, c.listing_id
  ),
  ended AS (
    UPDATE public.connections cn
    SET stage = 'ended',
        stage_expires_at = now()
    WHERE cn.id IN (SELECT connection_id FROM stale)
      AND cn.stage = 'chat_open'
    RETURNING cn.listing_id, cn.buyer_id
  )
  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE (l.id, l.locked_by) IN (SELECT listing_id, buyer_id FROM ended)
    AND l.status = 'locked';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_inactive_connection_chats() TO authenticated;

