-- Fix "limit 3 connections reached" when user has no visible open connections.
-- Cause: Connections past stage_expires_at still counted as active (e.g. on locked listings,
-- which process_connection_timeouts does not expire). So we only count as "active" when
-- stage is in the active set AND (stage is chat_open, which has no expiry, OR not past expiry).

-- 1) Buyer trigger: exclude connections that are past stage_expires_at (chat_open has no expiry).
CREATE OR REPLACE FUNCTION public.enforce_max_active_connections_per_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int; v_buyer uuid;
BEGIN
  v_buyer := COALESCE(NEW.buyer_id, OLD.buyer_id);
  IF v_buyer IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.stage = 'ended' AND NEW.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_buyer::text));
  SELECT count(*) INTO v_count FROM public.connections c
  WHERE c.buyer_id = v_buyer
    AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now())
    AND (TG_OP <> 'UPDATE' OR c.id <> NEW.id);
  IF COALESCE(v_count, 0) >= 5 THEN
    RAISE EXCEPTION 'You have reached the maximum of 5 active connection requests. Please complete or end one before connecting to another listing.';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) connect_to_listing_v2: same "not past expiry" rule for buyer and seller counts.
CREATE OR REPLACE FUNCTION public.connect_to_listing_v2(
  p_listing_id uuid,
  p_want_social_share boolean,
  p_bonding_answers jsonb DEFAULT NULL,
  p_question_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_connection_id uuid;
  v_qids uuid[];
  v_has_answers boolean;
  v_seller_active int;
  v_buyer_active int;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
  IF v_listing.status = 'locked' THEN RAISE EXCEPTION 'Listing already locked'; END IF;
  IF now() < v_listing.processing_until THEN RAISE EXCEPTION 'Listing is still processing'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot connect to your own listing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  SELECT count(*) INTO v_buyer_active FROM public.connections c
  WHERE c.buyer_id = auth.uid()
    AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());
  IF COALESCE(v_buyer_active, 0) >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 active connections. Complete or end one before connecting to another listing.';
  END IF;

  IF p_question_ids IS NOT NULL AND array_length(p_question_ids, 1) = 2 THEN
    IF EXISTS (
      SELECT 1 FROM public.bonding_questions
      WHERE id = p_question_ids[1] AND active = true
    ) AND EXISTS (
      SELECT 1 FROM public.bonding_questions
      WHERE id = p_question_ids[2] AND active = true
    ) THEN
      v_qids := p_question_ids;
    END IF;
  END IF;
  IF v_qids IS NULL OR array_length(v_qids, 1) <> 2 THEN
    v_qids := public.get_connection_bonding_question_ids();
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_bonding_answers WHERE user_id = auth.uid()) INTO v_has_answers;

  IF NOT v_has_answers THEN
    IF p_bonding_answers IS NULL OR jsonb_typeof(p_bonding_answers) <> 'object' THEN RAISE EXCEPTION 'Bonding answers required'; END IF;
    IF array_length(v_qids, 1) <> 2 THEN RAISE EXCEPTION 'Connection bonding questions not configured'; END IF;
    IF NOT (p_bonding_answers ? (v_qids[1]::text) AND p_bonding_answers ? (v_qids[2]::text)) THEN RAISE EXCEPTION 'Answer both bonding questions'; END IF;
    INSERT INTO public.user_bonding_answers (user_id, question_ids, answers, updated_at)
    VALUES (auth.uid(), v_qids, p_bonding_answers, now())
    ON CONFLICT (user_id) DO UPDATE SET question_ids = EXCLUDED.question_ids, answers = EXCLUDED.answers, updated_at = now();
  END IF;

  SELECT count(*) INTO v_seller_active
  FROM public.connections c
  WHERE c.seller_id = v_listing.seller_id
    AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());
  IF COALESCE(v_seller_active, 0) >= 3 THEN
    RAISE EXCEPTION 'This seller has reached the maximum number of active connections. Try another listing.';
  END IF;

  INSERT INTO public.connections (
    listing_id, buyer_id, seller_id, stage, stage_expires_at,
    buyer_want_social_share, buyer_social_share
  )
  VALUES (p_listing_id, auth.uid(), v_listing.seller_id, 'pending_seller', now() + interval '24 hours',
    p_want_social_share, p_want_social_share)
  RETURNING id INTO v_connection_id;

  PERFORM public.recompute_listing_lock(p_listing_id);

  RETURN v_connection_id;
END;
$$;
COMMENT ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb, uuid[]) IS
'Buyer connects to listing (v2). Enforces per-buyer (max 5) and per-seller (max 3) active limits; connections past stage_expires_at do not count.';

-- 3) seller_respond_connection: same "not past expiry" rule for seller active count.
CREATE OR REPLACE FUNCTION public.seller_respond_connection(
  p_connection_id uuid,
  p_accept boolean,
  p_seller_social_share boolean DEFAULT NULL
)
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
  v_buyer_has_answers boolean;
  v_seller_answers jsonb;
  v_buyer_answers jsonb;
  v_qids uuid[];
BEGIN
  SELECT * INTO v FROM public.connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v.stage <> 'pending_seller' THEN RAISE EXCEPTION 'Connection not in pending state'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Connection expired'; END IF;

  IF NOT p_accept THEN
    UPDATE public.connections
    SET stage = 'declined',
        stage_expires_at = now()
    WHERE id = p_connection_id;

    PERFORM public.recompute_listing_lock(v.listing_id);
    RETURN;
  END IF;

  SELECT count(*) INTO v_active FROM public.connections c
  WHERE c.seller_id = auth.uid() AND c.id <> p_connection_id
    AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());
  IF COALESCE(v_active, 0) >= 3 THEN RAISE EXCEPTION 'You can have at most 3 active connections. End one before accepting another.'; END IF;

  IF v.buyer_want_social_share IS NOT NULL THEN
    IF p_seller_social_share IS NULL THEN RAISE EXCEPTION 'Share socials decision required'; END IF;

    SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
    IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
    IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;

    v_qids := public.get_connection_bonding_question_ids();
    SELECT EXISTS (SELECT 1 FROM public.user_bonding_answers WHERE user_id = v.buyer_id) INTO v_buyer_has_answers;
    SELECT answers INTO v_seller_answers FROM public.user_bonding_answers WHERE user_id = auth.uid();
    SELECT answers INTO v_buyer_answers FROM public.user_bonding_answers WHERE user_id = v.buyer_id;

    UPDATE public.connections
    SET seller_social_share = p_seller_social_share,
        bonding_question_ids = v_qids,
        seller_bonding_answers = COALESCE(v_seller_answers, '{}'::jsonb),
        seller_bonding_submitted_at = CASE WHEN v_seller_answers IS NOT NULL THEN now() ELSE NULL END,
        stage_expires_at = now() + interval '24 hours'
    WHERE id = p_connection_id;

    IF v_buyer_has_answers AND v_buyer_answers IS NOT NULL THEN
      UPDATE public.connections
      SET buyer_bonding_answers = v_buyer_answers,
          buyer_bonding_submitted_at = now(),
          stage = 'agreement'
      WHERE id = p_connection_id;
    ELSE
      UPDATE public.connections
      SET stage = 'buyer_bonding_v2'
      WHERE id = p_connection_id;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;

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

COMMENT ON FUNCTION public.enforce_max_active_connections_per_buyer() IS
'Limit buyer to 5 active connections. Restoring from ended is allowed. Connections past stage_expires_at do not count (chat_open always counts).';
