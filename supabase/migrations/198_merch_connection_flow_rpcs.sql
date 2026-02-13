-- Merch: full connection flow RPCs (preview, bonding, comfort, social, agreement).
-- Mirrors ticket flow; uses merch_connections and merch_listings. Bonding uses same user_bonding_answers.

-- 1) get_merch_connection_preview
CREATE OR REPLACE FUNCTION public.get_merch_connection_preview(p_connection_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
  v_allowed boolean;
  v_listing json;
  v_buyer json;
  v_seller json;
  v_show_socials boolean;
  v_army_bias_prompt text;
  v_army_years_army_prompt text;
  v_army_favorite_album_prompt text;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;

  v_allowed := (auth.uid() = v.buyer_id OR auth.uid() = v.seller_id);
  IF NOT v_allowed THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage NOT IN ('preview','comfort','social','agreement','chat_open','ended','expired') THEN
    RAISE EXCEPTION 'Preview not available yet';
  END IF;

  SELECT MAX(CASE WHEN q.key = 'bias' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'years_army' THEN q.prompt END),
         MAX(CASE WHEN q.key = 'favorite_album' THEN q.prompt END)
  INTO v_army_bias_prompt, v_army_years_army_prompt, v_army_favorite_album_prompt
  FROM public.army_profile_questions q
  WHERE q.key IN ('bias', 'years_army', 'favorite_album');

  v_show_socials :=
    (v.buyer_social_share = true AND v.seller_social_share = true)
    AND (
      (auth.uid() = v.buyer_id AND v.buyer_agreed = true)
      OR (auth.uid() = v.seller_id AND v.seller_agreed = true)
    );

  SELECT json_build_object(
    'listingId', m.id,
    'title', m.title,
    'description', m.description,
    'quantity', m.quantity,
    'price', m.price,
    'currency', m.currency,
    'images', COALESCE(m.images, '{}')
  ) INTO v_listing
  FROM public.merch_listings m
  WHERE m.id = v.merch_listing_id;

  SELECT json_build_object(
    'id', p.id,
    'firstName', p.first_name,
    'country', p.country,
    'armyBiasAnswer', p.army_bias_answer,
    'armyYearsArmy', p.army_years_army,
    'armyFavoriteAlbum', p.army_favorite_album,
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'bondingAnswers', v.buyer_bonding_answers,
    'instagram', CASE WHEN v_show_socials THEN p.instagram ELSE NULL END,
    'facebook', CASE WHEN v_show_socials THEN p.facebook ELSE NULL END,
    'tiktok', CASE WHEN v_show_socials THEN p.tiktok ELSE NULL END,
    'snapchat', CASE WHEN v_show_socials THEN p.snapchat ELSE NULL END
  ) INTO v_buyer
  FROM public.user_profiles p WHERE p.id = v.buyer_id;

  SELECT json_build_object(
    'id', p.id,
    'firstName', p.first_name,
    'country', p.country,
    'armyBiasAnswer', p.army_bias_answer,
    'armyYearsArmy', p.army_years_army,
    'armyFavoriteAlbum', p.army_favorite_album,
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'bondingAnswers', v.seller_bonding_answers,
    'instagram', CASE WHEN v_show_socials THEN p.instagram ELSE NULL END,
    'facebook', CASE WHEN v_show_socials THEN p.facebook ELSE NULL END,
    'tiktok', CASE WHEN v_show_socials THEN p.tiktok ELSE NULL END,
    'snapchat', CASE WHEN v_show_socials THEN p.snapchat ELSE NULL END
  ) INTO v_seller
  FROM public.user_profiles p WHERE p.id = v.seller_id;

  RETURN json_build_object(
    'connectionId', v.id,
    'stage', v.stage,
    'stageExpiresAt', v.stage_expires_at,
    'buyerComfort', v.buyer_comfort,
    'sellerComfort', v.seller_comfort,
    'buyerSocialShare', v.buyer_social_share,
    'sellerSocialShare', v.seller_social_share,
    'buyerAgreed', v.buyer_agreed,
    'sellerAgreed', v.seller_agreed,
    'showSocials', v_show_socials,
    'listing', v_listing,
    'buyer', v_buyer,
    'seller', v_seller
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merch_connection_preview(uuid) TO authenticated;

-- 2) submit_merch_bonding_answers
CREATE OR REPLACE FUNCTION public.submit_merch_bonding_answers(p_connection_id uuid, p_answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
  v_q uuid[];
  v_needed int;
  v_seller_answers jsonb;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid());
  v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage = 'buyer_bonding_v2' THEN
    IF NOT v_is_buyer THEN RAISE EXCEPTION 'Only the buyer can submit at this step'; END IF;
    IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Step expired'; END IF;
    v_q := COALESCE(v.bonding_question_ids, public.get_connection_bonding_question_ids());
    v_needed := array_length(v_q, 1);
    IF v_needed IS NULL OR v_needed <> 2 THEN RAISE EXCEPTION 'Bonding questions not initialized'; END IF;
    IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Invalid answers'; END IF;
    IF NOT (p_answers ? (v_q[1]::text) AND p_answers ? (v_q[2]::text)) THEN RAISE EXCEPTION 'Answer both bonding questions'; END IF;

    INSERT INTO public.user_bonding_answers (user_id, question_ids, answers, updated_at)
    VALUES (auth.uid(), v_q, p_answers, now())
    ON CONFLICT (user_id) DO UPDATE SET question_ids = EXCLUDED.question_ids, answers = EXCLUDED.answers, updated_at = now();

    SELECT answers INTO v_seller_answers FROM public.user_bonding_answers WHERE user_id = v.seller_id;
    UPDATE public.merch_connections
    SET buyer_bonding_answers = p_answers, buyer_bonding_submitted_at = now(),
        seller_bonding_answers = COALESCE(v_seller_answers, '{}'::jsonb),
        seller_bonding_submitted_at = CASE WHEN v_seller_answers IS NOT NULL THEN now() ELSE NULL END,
        stage = 'agreement', stage_expires_at = now() + interval '24 hours'
    WHERE id = p_connection_id;
    RETURN;
  END IF;

  IF v.stage <> 'bonding' THEN RAISE EXCEPTION 'Not in bonding stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Bonding expired'; END IF;
  v_q := COALESCE(v.bonding_question_ids, '{}'::uuid[]);
  v_needed := array_length(v_q, 1);
  IF v_needed IS NULL OR v_needed <> 3 THEN RAISE EXCEPTION 'Bonding questions not initialized'; END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Invalid answers'; END IF;
  IF NOT (p_answers ? (v_q[1]::text) AND p_answers ? (v_q[2]::text) AND p_answers ? (v_q[3]::text)) THEN RAISE EXCEPTION 'All bonding questions must be answered'; END IF;

  IF v_is_buyer THEN
    UPDATE public.merch_connections SET buyer_bonding_answers = p_answers, buyer_bonding_submitted_at = now() WHERE id = p_connection_id;
  ELSE
    UPDATE public.merch_connections SET seller_bonding_answers = p_answers, seller_bonding_submitted_at = now() WHERE id = p_connection_id;
  END IF;

  UPDATE public.merch_connections SET stage = 'preview', stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id AND buyer_bonding_submitted_at IS NOT NULL AND seller_bonding_submitted_at IS NOT NULL AND stage = 'bonding';
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_merch_bonding_answers(uuid, jsonb) TO authenticated;

-- 3) set_merch_comfort_decision
CREATE OR REPLACE FUNCTION public.set_merch_comfort_decision(p_connection_id uuid, p_comfort boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.merch_connections%ROWTYPE; v_is_buyer boolean; v_is_seller boolean;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid()); v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v.stage <> 'preview' THEN RAISE EXCEPTION 'Not in preview stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Preview expired'; END IF;

  IF v_is_buyer THEN UPDATE public.merch_connections SET buyer_comfort = p_comfort WHERE id = p_connection_id;
  ELSE UPDATE public.merch_connections SET seller_comfort = p_comfort WHERE id = p_connection_id;
  END IF;

  IF (COALESCE((SELECT buyer_comfort FROM public.merch_connections WHERE id = p_connection_id), true) = false)
     OR (COALESCE((SELECT seller_comfort FROM public.merch_connections WHERE id = p_connection_id), true) = false) THEN
    UPDATE public.merch_connections SET stage = 'ended', stage_expires_at = now() WHERE id = p_connection_id;
    PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);
    RETURN;
  END IF;

  UPDATE public.merch_connections
  SET stage = 'social', stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id AND buyer_comfort = true AND seller_comfort = true AND stage = 'preview';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_merch_comfort_decision(uuid, boolean) TO authenticated;

-- 4) set_merch_social_share_decision
CREATE OR REPLACE FUNCTION public.set_merch_social_share_decision(p_connection_id uuid, p_share boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.merch_connections%ROWTYPE; v_is_buyer boolean; v_is_seller boolean;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid()); v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v.stage <> 'social' THEN RAISE EXCEPTION 'Not in social stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Social step expired'; END IF;

  IF v_is_buyer THEN UPDATE public.merch_connections SET buyer_social_share = p_share WHERE id = p_connection_id;
  ELSE UPDATE public.merch_connections SET seller_social_share = p_share WHERE id = p_connection_id;
  END IF;

  UPDATE public.merch_connections
  SET stage = 'agreement', stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id AND buyer_social_share IS NOT NULL AND seller_social_share IS NOT NULL AND stage = 'social';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_merch_social_share_decision(uuid, boolean) TO authenticated;

-- 5) accept_merch_connection_agreement
CREATE OR REPLACE FUNCTION public.accept_merch_connection_agreement(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.merch_connections%ROWTYPE; v_is_buyer boolean; v_is_seller boolean;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid()); v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v.stage <> 'agreement' THEN RAISE EXCEPTION 'Not in agreement stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Agreement expired'; END IF;

  IF v_is_buyer THEN UPDATE public.merch_connections SET buyer_agreed = true WHERE id = p_connection_id;
  ELSE UPDATE public.merch_connections SET seller_agreed = true WHERE id = p_connection_id;
  END IF;

  UPDATE public.merch_connections
  SET stage = 'chat_open', stage_expires_at = now() + interval '7 days'
  WHERE id = p_connection_id AND buyer_agreed = true AND seller_agreed = true AND stage = 'agreement';
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_merch_connection_agreement(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_merch_connection_preview(uuid) IS 'Preview for merch connection (same shape as ticket get_connection_preview).';
COMMENT ON FUNCTION public.submit_merch_bonding_answers(uuid, jsonb) IS 'Submit bonding answers for merch connection; uses user_bonding_answers.';
COMMENT ON FUNCTION public.set_merch_comfort_decision(uuid, boolean) IS 'Set comfort decision for merch connection.';
COMMENT ON FUNCTION public.set_merch_social_share_decision(uuid, boolean) IS 'Set social share decision for merch connection.';
COMMENT ON FUNCTION public.accept_merch_connection_agreement(uuid) IS 'Accept agreement for merch connection; moves to chat_open.';
