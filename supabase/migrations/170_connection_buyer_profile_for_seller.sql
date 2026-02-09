-- Buyer lite profile for seller when reviewing a connection request (pending_seller).
-- Allowed when the caller is the seller and the connection is in pending_seller.

CREATE OR REPLACE FUNCTION public.get_connection_buyer_profile_for_seller(p_connection_id uuid)
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
  FROM public.connections c
  WHERE c.id = p_connection_id
    AND c.seller_id = auth.uid()
    AND c.stage = 'pending_seller';

  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Connection not found or not allowed';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT up.username, up.country, up.army_bias_answer, up.army_years_army, up.army_favorite_album
  INTO v_username, v_country, v_army_bias_answer, v_army_years_army, v_army_favorite_album
  FROM public.user_profiles up
  WHERE up.id = v_buyer_id;

  SELECT
    MAX(CASE WHEN q.key = 'bias' THEN q.prompt END),
    MAX(CASE WHEN q.key = 'years_army' THEN q.prompt END),
    MAX(CASE WHEN q.key = 'favorite_album' THEN q.prompt END)
  INTO
    v_army_bias_prompt,
    v_army_years_army_prompt,
    v_army_favorite_album_prompt
  FROM public.army_profile_questions q
  WHERE q.key IN ('bias', 'years_army', 'favorite_album');

  v_qids := public.get_connection_bonding_question_ids();
  SELECT json_agg(
    json_build_object(
      'prompt', (SELECT bq.prompt FROM public.bonding_questions bq WHERE bq.id = qid),
      'answer', COALESCE(uba.answers ->> qid::text, '')
    ) ORDER BY array_position(v_qids, qid)
  )
  INTO v_bonding
  FROM unnest(COALESCE(v_qids, ARRAY[]::uuid[])) AS qid
  LEFT JOIN LATERAL (
    SELECT answers FROM public.user_bonding_answers WHERE user_id = v_buyer_id LIMIT 1
  ) uba ON true;

  RETURN json_build_object(
    'username', COALESCE(v_username, 'Buyer'),
    'country', COALESCE(v_country, ''),
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyBiasAnswer', COALESCE(v_army_bias_answer, ''),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyYearsArmy', COALESCE(v_army_years_army, ''),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'armyFavoriteAlbum', COALESCE(v_army_favorite_album, ''),
    'ticketSource', '',
    'ticketingExperience', '',
    'sellingReason', '',
    'priceExplanation', '',
    'bondingAnswers', COALESCE(v_bonding, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_buyer_profile_for_seller(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_connection_buyer_profile_for_seller(uuid) IS 'Buyer lite profile for seller when reviewing a request (pending_seller). Same shape as get_listing_seller_profile_for_connect.';
