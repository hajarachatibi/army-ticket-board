-- Remove processing_until <= now() so listings show in All Listings regardless of processing_until.

-- 1) browse_listings: stop filtering by processing_until
DROP FUNCTION IF EXISTS public.browse_listings();
CREATE OR REPLACE FUNCTION public.browse_listings()
RETURNS TABLE (
  listing_id uuid,
  concert_city text,
  concert_date date,
  status text,
  lock_expires_at timestamptz,
  vip boolean,
  loge boolean,
  suite boolean,
  seat_count int,
  seats json
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS listing_id,
    l.concert_city,
    l.concert_date,
    l.status,
    l.lock_expires_at,
    COALESCE(l.vip, false) AS vip,
    COALESCE(l.loge, false) AS loge,
    COALESCE(l.suite, false) AS suite,
    (SELECT count(*)::int FROM public.listing_seats WHERE listing_id = l.id) AS seat_count,
    (SELECT COALESCE(json_agg(
      json_build_object(
        'section', s2.section,
        'seat_row', s2.seat_row,
        'seat', s2.seat,
        'face_value_price', s2.face_value_price,
        'currency', COALESCE(s2.currency, 'USD')
      ) ORDER BY s2.seat_index
    ), '[]'::json) FROM public.listing_seats s2 WHERE s2.listing_id = l.id) AS seats
  FROM public.listings l
  INNER JOIN public.user_profiles up ON up.id = l.seller_id AND COALESCE(up.listings_held_for_review, false) = false
  WHERE l.status IN ('processing','active','locked','sold')
    AND l.status <> 'removed'
  ORDER BY
    CASE
      WHEN l.status = 'sold' THEN 2
      WHEN l.status = 'locked' THEN 1
      ELSE 0
    END ASC,
    l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.browse_listings() TO authenticated;

-- 2) get_browse_listing_seller_details: stop requiring processing_until passed
DROP FUNCTION IF EXISTS public.get_browse_listing_seller_details(uuid);
CREATE OR REPLACE FUNCTION public.get_browse_listing_seller_details(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_ticket_source text;
  v_ticketing_experience text;
  v_selling_reason text;
  v_price_explanation text;
BEGIN
  SELECT l.id, l.ticket_source, l.ticketing_experience, l.selling_reason, l.price_explanation
  INTO v_listing_id, v_ticket_source, v_ticketing_experience, v_selling_reason, v_price_explanation
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND l.status IN ('processing', 'active', 'locked', 'sold')
    AND l.status <> 'removed';

  IF v_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found or not available';
  END IF;

  RETURN json_build_object(
    'ticketSource', COALESCE(v_ticket_source, ''),
    'ticketingExperience', COALESCE(v_ticketing_experience, ''),
    'sellingReason', COALESCE(v_selling_reason, ''),
    'priceExplanation', COALESCE(v_price_explanation, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_browse_listing_seller_details(uuid) TO authenticated;

-- 3) get_listing_seller_profile_for_connect: stop requiring processing_until passed
CREATE OR REPLACE FUNCTION public.get_listing_seller_profile_for_connect(p_listing_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_username text;
  v_country text;
  v_army_bias_answer text;
  v_army_years_army text;
  v_army_favorite_album text;
  v_army_bias_prompt text;
  v_army_years_army_prompt text;
  v_army_favorite_album_prompt text;
  v_ticket_source text;
  v_ticketing_experience text;
  v_selling_reason text;
  v_price_explanation text;
  v_bonding json;
  v_qids uuid[];
BEGIN
  SELECT l.seller_id, l.ticket_source, l.ticketing_experience, l.selling_reason, l.price_explanation
  INTO v_seller_id, v_ticket_source, v_ticketing_experience, v_selling_reason, v_price_explanation
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND l.status IN ('processing', 'active', 'locked', 'sold')
    AND l.status <> 'removed';

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found or not available';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT up.username, up.country, up.army_bias_answer, up.army_years_army, up.army_favorite_album
  INTO v_username, v_country, v_army_bias_answer, v_army_years_army, v_army_favorite_album
  FROM public.user_profiles up
  WHERE up.id = v_seller_id;

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
    SELECT answers FROM public.user_bonding_answers WHERE user_id = v_seller_id LIMIT 1
  ) uba ON true;

  RETURN json_build_object(
    'username', COALESCE(v_username, 'Seller'),
    'country', COALESCE(v_country, ''),
    'armyBiasPrompt', COALESCE(v_army_bias_prompt, 'Bias'),
    'armyBiasAnswer', COALESCE(v_army_bias_answer, ''),
    'armyYearsArmyPrompt', COALESCE(v_army_years_army_prompt, 'Years ARMY'),
    'armyYearsArmy', COALESCE(v_army_years_army, ''),
    'armyFavoriteAlbumPrompt', COALESCE(v_army_favorite_album_prompt, 'Favorite album'),
    'armyFavoriteAlbum', COALESCE(v_army_favorite_album, ''),
    'ticketSource', COALESCE(v_ticket_source, ''),
    'ticketingExperience', COALESCE(v_ticketing_experience, ''),
    'sellingReason', COALESCE(v_selling_reason, ''),
    'priceExplanation', COALESCE(v_price_explanation, ''),
    'bondingAnswers', COALESCE(v_bonding, '[]'::json)
  );
END;
$$;

COMMENT ON FUNCTION public.get_listing_seller_profile_for_connect(uuid) IS 'Seller profile for connect modal. Allowed when listing status is processing/active/locked/sold (no processing_until check).';
