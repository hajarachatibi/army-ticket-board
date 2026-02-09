-- Fix: "Answer both bonding questions" when user did answer.
-- get_connection_bonding_question_ids() uses ORDER BY random(), so the frontend and the RPC
-- can get different pairs; the RPC then validates the wrong IDs. Accept optional p_question_ids
-- from the client and use those for validation when provided.

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
    AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');
  IF COALESCE(v_buyer_active, 0) >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 active connections. Complete or end one before connecting to another listing.';
  END IF;

  -- Use client-provided question IDs when valid (same pair the user was shown), else server-chosen.
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

GRANT EXECUTE ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb, uuid[]) IS 'Buyer connects to listing (v2). Optional p_question_ids: use these for bonding validation when provided (must be 2 active question IDs).';
