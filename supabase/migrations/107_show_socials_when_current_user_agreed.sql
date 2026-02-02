-- Show socials as soon as both chose to share AND the current user has confirmed
-- (no need to wait for the other ARMY to confirm the agreement step).

DROP FUNCTION IF EXISTS public.get_connection_preview(uuid);
CREATE OR REPLACE FUNCTION public.get_connection_preview(p_connection_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_allowed boolean;
  v_listing json;
  v_buyer json;
  v_seller json;
  v_show_socials boolean;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  v_allowed := (auth.uid() = v.buyer_id OR auth.uid() = v.seller_id);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v.stage NOT IN ('preview','comfort','social','agreement','chat_open','ended','expired') THEN
    RAISE EXCEPTION 'Preview not available yet';
  END IF;

  -- Show socials when both chose to share AND the current user has confirmed the agreement.
  -- No need to wait for the other user to confirm.
  v_show_socials :=
    (v.buyer_social_share = true AND v.seller_social_share = true)
    AND (
      (auth.uid() = v.buyer_id AND v.buyer_agreed = true)
      OR (auth.uid() = v.seller_id AND v.seller_agreed = true)
    );

  SELECT json_build_object(
    'listingId', l.id,
    'concertCity', l.concert_city,
    'concertDate', l.concert_date::text,
    'ticketSource', l.ticket_source,
    'ticketingExperience', l.ticketing_experience,
    'sellingReason', l.selling_reason,
    'seats', COALESCE((
      SELECT json_agg(json_build_object(
        'seatIndex', s.seat_index,
        'section', s.section,
        'seatRow', s.seat_row,
        'seat', s.seat,
        'faceValuePrice', s.face_value_price,
        'currency', s.currency
      ) ORDER BY s.seat_index)
      FROM public.listing_seats s
      WHERE s.listing_id = l.id
    ), '[]'::json)
  ) INTO v_listing
  FROM public.listings l
  WHERE l.id = v.listing_id;

  SELECT json_build_object(
    'id', p.id,
    'firstName', p.first_name,
    'country', p.country,
    'armyBiasAnswer', p.army_bias_answer,
    'armyYearsArmy', p.army_years_army,
    'armyFavoriteAlbum', p.army_favorite_album,
    'bondingAnswers', v.buyer_bonding_answers,
    'instagram', CASE WHEN v_show_socials THEN p.instagram ELSE NULL END,
    'facebook', CASE WHEN v_show_socials THEN p.facebook ELSE NULL END,
    'tiktok', CASE WHEN v_show_socials THEN p.tiktok ELSE NULL END,
    'snapchat', CASE WHEN v_show_socials THEN p.snapchat ELSE NULL END
  ) INTO v_buyer
  FROM public.user_profiles p
  WHERE p.id = v.buyer_id;

  SELECT json_build_object(
    'id', p.id,
    'firstName', p.first_name,
    'country', p.country,
    'armyBiasAnswer', p.army_bias_answer,
    'armyYearsArmy', p.army_years_army,
    'armyFavoriteAlbum', p.army_favorite_album,
    'bondingAnswers', v.seller_bonding_answers,
    'instagram', CASE WHEN v_show_socials THEN p.instagram ELSE NULL END,
    'facebook', CASE WHEN v_show_socials THEN p.facebook ELSE NULL END,
    'tiktok', CASE WHEN v_show_socials THEN p.tiktok ELSE NULL END,
    'snapchat', CASE WHEN v_show_socials THEN p.snapchat ELSE NULL END
  ) INTO v_seller
  FROM public.user_profiles p
  WHERE p.id = v.seller_id;

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

GRANT EXECUTE ON FUNCTION public.get_connection_preview(uuid) TO authenticated;
