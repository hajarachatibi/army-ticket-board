-- Allow a buyer to have multiple active connection requests (up to 3, to different listings).
-- The "Duplicate key" error was caused by an old unique index from migration 061 that allowed
-- only ONE active connection per buyer. Later migrations (083, 099) intended to allow multiple
-- requests per buyer (max 3 via trigger) and use (listing_id, buyer_id) to prevent duplicate
-- request to the same listing. Dropping the buyer-only unique index restores that behavior.

DROP INDEX IF EXISTS public.uniq_connections_one_active_per_buyer;

-- Friendly error when buyer already has a connection to this listing (same listing, double-click or race).
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

  -- Already have a connection (pending or active) for this listing?
  IF EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.listing_id = p_listing_id
      AND c.buyer_id = auth.uid()
      AND c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open')
  ) THEN
    RAISE EXCEPTION 'You already have a connection request for this listing';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.connections c
  WHERE c.buyer_id = auth.uid()
    AND c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');
  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 active connection requests. Please complete or end one before connecting to another listing.';
  END IF;

  INSERT INTO public.connections (listing_id, buyer_id, seller_id, stage, stage_expires_at)
  VALUES (p_listing_id, auth.uid(), v_listing.seller_id, 'pending_seller', now() + interval '24 hours')
  RETURNING id INTO v_connection_id;

  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_listing(uuid) TO authenticated;

-- Same clear message in trigger (in case limit is hit via trigger path).
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
    RAISE EXCEPTION 'You have reached the maximum of 3 active connection requests. Please complete or end one before connecting to another listing.';
  END IF;

  RETURN NEW;
END;
$$;
