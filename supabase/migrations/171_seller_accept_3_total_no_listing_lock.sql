-- Seller can accept up to 3 active connections total (across all listings).
-- Remove per-listing lock: do not require listing to be unlocked on accept, and do not lock listing on accept.
-- Allow new connection requests (connect_to_listing_v2) as long as seller has < 3 active, regardless of listing.locked_by.

-- 1) connect_to_listing_v2: allow connect when seller has < 3 active; drop "Listing already locked" check
CREATE OR REPLACE FUNCTION public.connect_to_listing_v2(
  p_listing_id uuid,
  p_want_social_share boolean,
  p_bonding_answers jsonb DEFAULT NULL
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
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
  IF now() < v_listing.processing_until THEN RAISE EXCEPTION 'Listing is still processing'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot connect to your own listing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.buyer_id = auth.uid()
      AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
  ) THEN
    RAISE EXCEPTION 'You already have an active connection. Complete or end one before connecting to another listing.';
  END IF;

  v_qids := public.get_connection_bonding_question_ids();
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
    AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');
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
  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb) TO authenticated;

-- 2) seller_respond_connection: only enforce seller total active < 3; do not check or set listing lock
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
    UPDATE public.connections SET stage = 'declined', stage_expires_at = now() WHERE id = p_connection_id;
    UPDATE public.listings SET status = 'active', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL WHERE id = v.listing_id;
    RETURN;
  END IF;

  -- Enforce max 3 active connections per seller (across all listings)
  SELECT count(*) INTO v_active FROM public.connections c
  WHERE c.seller_id = auth.uid() AND c.id <> p_connection_id
    AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');
  IF COALESCE(v_active, 0) >= 3 THEN RAISE EXCEPTION 'You can have at most 3 active connections. End one before accepting another.'; END IF;

  IF v.buyer_want_social_share IS NOT NULL THEN
    IF p_seller_social_share IS NULL THEN RAISE EXCEPTION 'Share socials decision required'; END IF;

    SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
    IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
    IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
    -- Do not check or set listing lock; seller limit (3 total) is enforced above.

    v_qids := public.get_connection_bonding_question_ids();
    SELECT EXISTS (SELECT 1 FROM public.user_bonding_answers WHERE user_id = v.buyer_id) INTO v_buyer_has_answers;
    SELECT answers INTO v_seller_answers FROM public.user_bonding_answers WHERE user_id = auth.uid();
    SELECT answers INTO v_buyer_answers FROM public.user_bonding_answers WHERE user_id = v.buyer_id;

    UPDATE public.connections
    SET seller_social_share = p_seller_social_share, bonding_question_ids = v_qids,
        seller_bonding_answers = COALESCE(v_seller_answers, '{}'::jsonb),
        seller_bonding_submitted_at = CASE WHEN v_seller_answers IS NOT NULL THEN now() ELSE NULL END,
        stage_expires_at = now() + interval '24 hours'
    WHERE id = p_connection_id;

    IF v_buyer_has_answers AND v_buyer_answers IS NOT NULL THEN
      UPDATE public.connections
      SET buyer_bonding_answers = v_buyer_answers, buyer_bonding_submitted_at = now(), stage = 'agreement'
      WHERE id = p_connection_id;
    ELSE
      UPDATE public.connections SET stage = 'buyer_bonding_v2' WHERE id = p_connection_id;
    END IF;
    RETURN;
  END IF;

  -- Legacy path (buyer_want_social_share IS NULL): same rule — only seller active count
  SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
  -- Do not check or set listing lock.

  SELECT array_agg(id) INTO v_q FROM (SELECT id FROM public.bonding_questions WHERE active = true ORDER BY random() LIMIT 3) s;
  UPDATE public.connections
  SET stage = 'bonding', stage_expires_at = now() + interval '24 hours', bonding_question_ids = COALESCE(v_q, '{}'::uuid[])
  WHERE id = p_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_respond_connection(uuid, boolean, boolean) TO authenticated;
