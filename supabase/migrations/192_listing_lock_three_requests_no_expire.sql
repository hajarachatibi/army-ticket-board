-- Listing lock rules (per-listing 3 requests) and non-expiring locked requests.
-- 1) Each listing that reaches three active/pending connection requests is locked.
-- 2) While a listing is locked, its connection requests do NOT auto-expire via process_connection_timeouts;
--    they only end when the buyer or seller explicitly ends/declines the connection.
-- 3) When an active/locked connection is ended/declined, the listing lock is recomputed:
--    - if it now has < 3 active/pending connections, it becomes active again;
--    - otherwise it stays locked.

-- Helper: recompute listing.lock status from connection stages.
CREATE OR REPLACE FUNCTION public.recompute_listing_lock(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active int;
  v_status text;
BEGIN
  IF p_listing_id IS NULL THEN
    RETURN;
  END IF;

  -- Lock row while we check/update status.
  SELECT status
  INTO v_status
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  -- Listing not found or no longer relevant (sold/removed) – nothing to do.
  IF v_status IS NULL OR v_status IN ('sold', 'removed') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_active
  FROM public.connections c
  WHERE c.listing_id = p_listing_id
    AND c.stage IN (
      'pending_seller',
      'bonding',
      'buyer_bonding_v2',
      'preview',
      'comfort',
      'social',
      'agreement',
      'chat_open'
    );

  IF COALESCE(v_active, 0) >= 3 THEN
    UPDATE public.listings
    SET status = 'locked',
        locked_by = NULL,
        locked_at = COALESCE(locked_at, now()),
        lock_expires_at = NULL
    WHERE id = p_listing_id;
  ELSE
    UPDATE public.listings
    SET status = 'active',
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = p_listing_id
      AND status = 'locked';
  END IF;
END;
$$;

-- 2) connect_to_listing_v2: keep existing buyer/seller total limits, but:
--    - reject connecting to locked listings;
--    - after inserting a new connection, recompute the per-listing lock.
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

  -- After inserting, recompute per-listing lock (3+ active/pending requests -> locked).
  PERFORM public.recompute_listing_lock(p_listing_id);

  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.connect_to_listing_v2(uuid, boolean, jsonb, uuid[]) IS
'Buyer connects to listing (v2). Enforces per-buyer and per-seller active limits, and locks a listing once it has 3+ active/pending connection requests.';

-- 3) seller_respond_connection: on decline, just change the stage and then recompute the listing lock.
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

    -- Recompute listing lock after this request is declined.
    PERFORM public.recompute_listing_lock(v.listing_id);
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

  -- Legacy path (buyer_want_social_share IS NULL): same rule — only seller active count
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

GRANT EXECUTE ON FUNCTION public.seller_respond_connection(uuid, boolean, boolean) TO authenticated;

-- 4) end_connection: after ending, recompute listing lock instead of relying on locked_by.
DROP FUNCTION IF EXISTS public.end_connection(uuid);
DROP FUNCTION IF EXISTS public.end_connection(uuid, text);
CREATE OR REPLACE FUNCTION public.end_connection(p_connection_id uuid, p_ended_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_message text;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
  INTO v_summary
  FROM public.listings l
  WHERE l.id = v.listing_id;
  v_summary := COALESCE(NULLIF(trim(v_summary), ''), 'Listing');

  UPDATE public.connections
  SET stage = 'ended',
      stage_expires_at = now()
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

  -- Recompute listing lock after this connection is ended.
  PERFORM public.recompute_listing_lock(v.listing_id);

  -- Notify only the other party (the one who didn't end it).
  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  v_message := COALESCE(
    NULLIF(trim(p_ended_reason), ''),
    CASE
      WHEN auth.uid() = v.seller_id THEN 'The seller ended the connection.'
      ELSE 'The buyer ended the connection.'
    END
  );

  PERFORM public.notify_user(
    v_notify_user_id,
    'connection_ended',
    v_message,
    NULL,
    NULL,
    v.listing_id,
    v_summary,
    p_connection_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_connection(uuid, text) TO authenticated;

-- 5) process_connection_timeouts: do not expire requests for locked listings.
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
    WHERE c.stage IN (
            'pending_seller',
            'bonding',
            'buyer_bonding_v2',
            'preview',
            'comfort',
            'social',
            'agreement'
          )
      AND c.stage_expires_at < now()
      AND NOT EXISTS (
        SELECT 1
        FROM public.listings l
        WHERE l.id = c.listing_id
          AND l.status = 'locked'
      )
    RETURNING c.listing_id
  )
  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE l.id IN (SELECT listing_id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_connection_timeouts() TO authenticated;

