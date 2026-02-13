-- Merch: RPCs for create listing, connect, seller respond, end, and profile for connect/accept.
-- No buyer/seller connection limits. Lock when active connections >= 3 * quantity.

-- 1) create_merch_listing (no limit on number of listings per seller)
CREATE OR REPLACE FUNCTION public.create_merch_listing(
  p_title text,
  p_description text,
  p_quantity int,
  p_price numeric,
  p_currency text DEFAULT 'USD',
  p_images text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_listing_id uuid;
BEGIN
  v_seller_id := auth.uid();
  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  IF NULLIF(trim(p_title), '') IS NULL THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;
  IF p_price IS NULL OR p_price < 0 THEN RAISE EXCEPTION 'Price must be 0 or more'; END IF;
  IF p_images IS NULL THEN p_images := '{}'; END IF;

  INSERT INTO public.merch_listings (seller_id, title, description, quantity, price, currency, images, status)
  VALUES (v_seller_id, trim(p_title), NULLIF(trim(p_description), ''), p_quantity, p_price, COALESCE(NULLIF(trim(p_currency), ''), 'USD'), p_images, 'active')
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_merch_listing(text, text, int, numeric, text, text[]) TO authenticated;

-- 2) connect_to_merch_listing_v2 (no buyer/seller limits; lock at 3*quantity)
CREATE OR REPLACE FUNCTION public.connect_to_merch_listing_v2(
  p_merch_listing_id uuid,
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
  v_listing public.merch_listings%ROWTYPE;
  v_connection_id uuid;
  v_qids uuid[];
  v_has_answers boolean;
BEGIN
  SELECT * INTO v_listing FROM public.merch_listings WHERE id = p_merch_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
  IF v_listing.status = 'locked' THEN RAISE EXCEPTION 'Listing already locked'; END IF;
  IF v_listing.seller_id = auth.uid() THEN RAISE EXCEPTION 'Cannot connect to your own listing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid() AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  IF p_question_ids IS NOT NULL AND array_length(p_question_ids, 1) = 2 THEN
    IF EXISTS (SELECT 1 FROM public.bonding_questions WHERE id = p_question_ids[1] AND active = true)
       AND EXISTS (SELECT 1 FROM public.bonding_questions WHERE id = p_question_ids[2] AND active = true) THEN
      v_qids := p_question_ids;
    END IF;
  END IF;
  IF v_qids IS NULL OR array_length(v_qids, 1) <> 2 THEN
    v_qids := public.get_connection_bonding_question_ids();
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_bonding_answers WHERE user_id = auth.uid()) INTO v_has_answers;
  IF NOT v_has_answers THEN
    IF p_bonding_answers IS NULL OR jsonb_typeof(p_bonding_answers) <> 'object' THEN RAISE EXCEPTION 'Bonding answers required'; END IF;
    IF NOT (p_bonding_answers ? (v_qids[1]::text) AND p_bonding_answers ? (v_qids[2]::text)) THEN RAISE EXCEPTION 'Answer both bonding questions'; END IF;
    INSERT INTO public.user_bonding_answers (user_id, question_ids, answers, updated_at)
    VALUES (auth.uid(), v_qids, p_bonding_answers, now())
    ON CONFLICT (user_id) DO UPDATE SET question_ids = EXCLUDED.question_ids, answers = EXCLUDED.answers, updated_at = now();
  END IF;

  INSERT INTO public.merch_connections (
    merch_listing_id, buyer_id, seller_id, stage, stage_expires_at,
    buyer_want_social_share, buyer_social_share
  )
  VALUES (p_merch_listing_id, auth.uid(), v_listing.seller_id, 'pending_seller', now() + interval '24 hours',
    p_want_social_share, p_want_social_share)
  RETURNING id INTO v_connection_id;

  PERFORM public.recompute_merch_listing_lock(p_merch_listing_id);

  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_merch_listing_v2(uuid, boolean, jsonb, uuid[]) TO authenticated;

-- 3) seller_respond_merch_connection (no seller connection limit)
CREATE OR REPLACE FUNCTION public.seller_respond_merch_connection(
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
  v public.merch_connections%ROWTYPE;
  v_listing public.merch_listings%ROWTYPE;
  v_qids uuid[];
  v_buyer_has_answers boolean;
  v_seller_answers jsonb;
  v_buyer_answers jsonb;
  v_q uuid[];
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v.stage <> 'pending_seller' THEN RAISE EXCEPTION 'Connection not in pending state'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Connection expired'; END IF;

  IF NOT p_accept THEN
    UPDATE public.merch_connections SET stage = 'declined', stage_expires_at = now() WHERE id = p_connection_id;
    PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);
    RETURN;
  END IF;

  IF v.buyer_want_social_share IS NOT NULL THEN
    IF p_seller_social_share IS NULL THEN RAISE EXCEPTION 'Share socials decision required'; END IF;
    SELECT * INTO v_listing FROM public.merch_listings WHERE id = v.merch_listing_id FOR UPDATE;
    IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
    IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;

    v_qids := public.get_connection_bonding_question_ids();
    SELECT EXISTS (SELECT 1 FROM public.user_bonding_answers WHERE user_id = v.buyer_id) INTO v_buyer_has_answers;
    SELECT answers INTO v_seller_answers FROM public.user_bonding_answers WHERE user_id = auth.uid();
    SELECT answers INTO v_buyer_answers FROM public.user_bonding_answers WHERE user_id = v.buyer_id;

    UPDATE public.merch_connections
    SET seller_social_share = p_seller_social_share,
        bonding_question_ids = v_qids,
        seller_bonding_answers = COALESCE(v_seller_answers, '{}'::jsonb),
        seller_bonding_submitted_at = CASE WHEN v_seller_answers IS NOT NULL THEN now() ELSE NULL END,
        stage_expires_at = now() + interval '24 hours'
    WHERE id = p_connection_id;

    IF v_buyer_has_answers AND v_buyer_answers IS NOT NULL THEN
      UPDATE public.merch_connections
      SET buyer_bonding_answers = v_buyer_answers, buyer_bonding_submitted_at = now(), stage = 'agreement'
      WHERE id = p_connection_id;
    ELSE
      UPDATE public.merch_connections SET stage = 'buyer_bonding_v2' WHERE id = p_connection_id;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_listing FROM public.merch_listings WHERE id = v.merch_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;

  SELECT array_agg(id) INTO v_q FROM (
    SELECT id FROM public.bonding_questions WHERE active = true ORDER BY random() LIMIT 3
  ) s;

  UPDATE public.merch_connections
  SET stage = 'bonding', stage_expires_at = now() + interval '24 hours', bonding_question_ids = COALESCE(v_q, '{}'::uuid[])
  WHERE id = p_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_respond_merch_connection(uuid, boolean, boolean) TO authenticated;

-- 4) end_merch_connection
CREATE OR REPLACE FUNCTION public.end_merch_connection(p_connection_id uuid, p_ended_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.merch_connections%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  UPDATE public.merch_connections
  SET stage = 'ended', stage_expires_at = now(),
      ended_by = auth.uid(), ended_at = now(), stage_before_ended = v.stage
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');

  PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_merch_connection(uuid, text) TO authenticated;

-- 5) get_merch_listing_seller_profile_for_connect (same shape as ticket version for UI)
CREATE OR REPLACE FUNCTION public.get_merch_listing_seller_profile_for_connect(p_merch_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_title text;
  v_price numeric;
  v_currency text;
  v_username text;
  v_country text;
  v_army_bias_answer text;
  v_army_years_army text;
  v_army_favorite_album text;
  v_army_bias_prompt text;
  v_army_years_army_prompt text;
  v_army_favorite_album_prompt text;
  v_bonding json;
  v_qids uuid[];
BEGIN
  SELECT m.seller_id, m.title, m.price, m.currency
  INTO v_seller_id, v_title, v_price, v_currency
  FROM public.merch_listings m
  WHERE m.id = p_merch_listing_id AND m.status IN ('active','locked');

  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'Listing not found or not available'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT up.username, up.country, up.army_bias_answer, up.army_years_army, up.army_favorite_album
  INTO v_username, v_country, v_army_bias_answer, v_army_years_army, v_army_favorite_album
  FROM public.user_profiles up WHERE up.id = v_seller_id;

  SELECT MAX(CASE WHEN q.key = 'bias' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'years_army' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'favorite_album' THEN q.prompt END)
  INTO v_army_bias_prompt, v_army_years_army_prompt, v_army_favorite_album_prompt
  FROM public.army_profile_questions q WHERE q.key IN ('bias', 'years_army', 'favorite_album');

  v_qids := public.get_connection_bonding_question_ids();
  SELECT json_agg(json_build_object(
    'prompt', (SELECT bq.prompt FROM public.bonding_questions bq WHERE bq.id = qid),
    'answer', COALESCE(uba.answers ->> qid::text, '')
  ) ORDER BY array_position(v_qids, qid))
  INTO v_bonding
  FROM unnest(COALESCE(v_qids, ARRAY[]::uuid[])) AS qid
  LEFT JOIN LATERAL (SELECT answers FROM public.user_bonding_answers WHERE user_id = v_seller_id LIMIT 1) uba ON true;

  RETURN json_build_object(
    'username', COALESCE(v_username, 'Seller'),
    'country', COALESCE(v_country, ''),
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyBiasAnswer', COALESCE(v_army_bias_answer, ''),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyYearsArmy', COALESCE(v_army_years_army, ''),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'armyFavoriteAlbum', COALESCE(v_army_favorite_album, ''),
    'ticketSource', COALESCE(v_title, ''),
    'ticketingExperience', '',
    'sellingReason', '',
    'priceExplanation', v_price::text || ' ' || COALESCE(v_currency, 'USD'),
    'bondingAnswers', COALESCE(v_bonding, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merch_listing_seller_profile_for_connect(uuid) TO authenticated;

-- 6) get_merch_connection_buyer_profile_for_seller
CREATE OR REPLACE FUNCTION public.get_merch_connection_buyer_profile_for_seller(p_connection_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
  v_username text;
  v_country text;
  v_army_bias_answer text;
  v_army_years_army text;
  v_army_favorite_album text;
  v_army_bias_prompt text;
  v_army_years_army_prompt text;
  v_army_favorite_album_prompt text;
  v_bonding json;
  v_qids uuid[];
BEGIN
  SELECT c.buyer_id INTO v_buyer_id
  FROM public.merch_connections c
  WHERE c.id = p_connection_id AND c.seller_id = auth.uid() AND c.stage = 'pending_seller';

  IF v_buyer_id IS NULL THEN RAISE EXCEPTION 'Connection not found or not allowed'; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT up.username, up.country, up.army_bias_answer, up.army_years_army, up.army_favorite_album
  INTO v_username, v_country, v_army_bias_answer, v_army_years_army, v_army_favorite_album
  FROM public.user_profiles up WHERE up.id = v_buyer_id;

  SELECT MAX(CASE WHEN q.key = 'bias' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'years_army' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'favorite_album' THEN q.prompt END)
  INTO v_army_bias_prompt, v_army_years_army_prompt, v_army_favorite_album_prompt
  FROM public.army_profile_questions q WHERE q.key IN ('bias', 'years_army', 'favorite_album');

  v_qids := public.get_connection_bonding_question_ids();
  SELECT json_agg(json_build_object(
    'prompt', (SELECT bq.prompt FROM public.bonding_questions bq WHERE bq.id = qid),
    'answer', COALESCE(uba.answers ->> qid::text, '')
  ) ORDER BY array_position(v_qids, qid))
  INTO v_bonding
  FROM unnest(COALESCE(v_qids, ARRAY[]::uuid[])) AS qid
  LEFT JOIN LATERAL (SELECT answers FROM public.user_bonding_answers WHERE user_id = v_buyer_id LIMIT 1) uba ON true;

  RETURN json_build_object(
    'username', COALESCE(v_username, 'Buyer'),
    'country', COALESCE(v_country, ''),
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyBiasAnswer', COALESCE(v_army_bias_answer, ''),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyYearsArmy', COALESCE(v_army_years_army, ''),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'armyFavoriteAlbum', COALESCE(v_army_favorite_album, ''),
    'ticketSource', '', 'ticketingExperience', '', 'sellingReason', '', 'priceExplanation', '',
    'bondingAnswers', COALESCE(v_bonding, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merch_connection_buyer_profile_for_seller(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_merch_listing(text, text, int, numeric, text, text[]) IS 'Create a merch listing. No limit on listings per seller.';
COMMENT ON FUNCTION public.connect_to_merch_listing_v2(uuid, boolean, jsonb, uuid[]) IS 'Buyer connects to merch listing. No buyer/seller connection limits. Lock at 3*quantity.';
COMMENT ON FUNCTION public.seller_respond_merch_connection(uuid, boolean, boolean) IS 'Seller accept/decline merch connection. No seller connection limit.';
COMMENT ON FUNCTION public.end_merch_connection(uuid, text) IS 'End a merch connection; recomputes listing lock.';
