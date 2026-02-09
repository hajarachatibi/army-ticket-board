-- Connections flow v2: user-level bonding answers, socials at connect/accept, 3 listings / 3 seller connections.

-- 1) User-level bonding answers (reused across all connections)
CREATE TABLE IF NOT EXISTS public.user_bonding_answers (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  question_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bonding_answers_user ON public.user_bonding_answers(user_id);

ALTER TABLE public.user_bonding_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_bonding_answers_select_own" ON public.user_bonding_answers;
CREATE POLICY "user_bonding_answers_select_own"
  ON public.user_bonding_answers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bonding_answers_insert_own" ON public.user_bonding_answers;
CREATE POLICY "user_bonding_answers_insert_own"
  ON public.user_bonding_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bonding_answers_update_own" ON public.user_bonding_answers;
CREATE POLICY "user_bonding_answers_update_own"
  ON public.user_bonding_answers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_bonding_answers_select_admin" ON public.user_bonding_answers;
CREATE POLICY "user_bonding_answers_select_admin"
  ON public.user_bonding_answers FOR SELECT TO authenticated
  USING (public.is_admin());

-- 2) Which 2 bonding questions to use for connection flow (admin-configured)
CREATE TABLE IF NOT EXISTS public.connection_bonding_questions (
  sort_order int PRIMARY KEY CHECK (sort_order IN (0, 1)),
  question_id uuid NOT NULL REFERENCES public.bonding_questions(id) ON DELETE CASCADE
);

INSERT INTO public.connection_bonding_questions (sort_order, question_id)
SELECT 0, id FROM public.bonding_questions WHERE active = true ORDER BY created_at LIMIT 1
ON CONFLICT (sort_order) DO NOTHING;
INSERT INTO public.connection_bonding_questions (sort_order, question_id)
SELECT 1, id FROM public.bonding_questions WHERE active = true ORDER BY created_at OFFSET 1 LIMIT 1
ON CONFLICT (sort_order) DO NOTHING;

ALTER TABLE public.connection_bonding_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connection_bonding_questions_select" ON public.connection_bonding_questions;
CREATE POLICY "connection_bonding_questions_select"
  ON public.connection_bonding_questions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "connection_bonding_questions_admin" ON public.connection_bonding_questions;
CREATE POLICY "connection_bonding_questions_admin"
  ON public.connection_bonding_questions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Connections: add buyer_want_social_share (set at connect for v2)
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS buyer_want_social_share boolean;

-- 4) Add stage buyer_bonding_v2
DO $$
BEGIN
  ALTER TABLE public.connections DROP CONSTRAINT IF EXISTS connections_stage_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.connections
  ADD CONSTRAINT connections_stage_check
  CHECK (stage IN ('pending_seller','declined','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open','ended','expired'));

-- 5) Listing limit: max 3 non-removed per user
DROP FUNCTION IF EXISTS public.enforce_max_active_listings();
CREATE OR REPLACE FUNCTION public.enforce_max_active_listings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_count int;
BEGIN
  v_seller := COALESCE(NEW.seller_id, OLD.seller_id);
  IF v_seller IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_seller::text));
  SELECT count(*) INTO v_count
  FROM public.listings l
  WHERE l.seller_id = v_seller
    AND l.status IN ('processing','active','locked','sold')
    AND (TG_OP <> 'UPDATE' OR l.id <> OLD.id);
  IF NEW.status IN ('processing','active','locked','sold') AND COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You can have at most 3 listings at a time (including sold). Remove or wait for one to complete.';
  END IF;
  RETURN NEW;
END;
$$;

-- 6) RPC: get connection bonding question ids (the 2 for v2)
DROP FUNCTION IF EXISTS public.get_connection_bonding_question_ids();
CREATE OR REPLACE FUNCTION public.get_connection_bonding_question_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(question_id ORDER BY sort_order)
  FROM public.connection_bonding_questions;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_bonding_question_ids() TO authenticated;

-- 7) RPC: upsert user bonding answers
DROP FUNCTION IF EXISTS public.upsert_user_bonding_answers(uuid[], jsonb);
CREATE OR REPLACE FUNCTION public.upsert_user_bonding_answers(p_question_ids uuid[], p_answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(p_question_ids, 1) <> 2 THEN RAISE EXCEPTION 'Exactly 2 question IDs required'; END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Invalid answers'; END IF;
  IF NOT (p_answers ? (p_question_ids[1]::text) AND p_answers ? (p_question_ids[2]::text)) THEN
    RAISE EXCEPTION 'Answers required for both questions';
  END IF;
  INSERT INTO public.user_bonding_answers (user_id, question_ids, answers, updated_at)
  VALUES (auth.uid(), p_question_ids, p_answers, now())
  ON CONFLICT (user_id) DO UPDATE
  SET question_ids = EXCLUDED.question_ids, answers = EXCLUDED.answers, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_bonding_answers(uuid[], jsonb) TO authenticated;

-- 8) RPC: connect_to_listing_v2 (buyer: socials intent + optional bonding)
DROP FUNCTION IF EXISTS public.connect_to_listing_v2(uuid, boolean, jsonb);
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
  IF v_listing.locked_by IS NOT NULL THEN RAISE EXCEPTION 'Listing already locked'; END IF;
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

-- 9) seller_respond_connection: v2 path (seller_social_share, then agreement or buyer_bonding_v2)
DROP FUNCTION IF EXISTS public.seller_respond_connection(uuid, boolean);
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

  IF v.buyer_want_social_share IS NOT NULL THEN
    IF p_seller_social_share IS NULL THEN RAISE EXCEPTION 'Share socials decision required'; END IF;
    SELECT count(*) INTO v_active FROM public.connections c
    WHERE c.seller_id = auth.uid() AND c.id <> p_connection_id
      AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');
    IF COALESCE(v_active, 0) >= 3 THEN RAISE EXCEPTION 'You can have at most 3 active connections. End one before accepting another.'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(v.listing_id::text));
    SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
    IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
    IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
    IF v_listing.locked_by IS NOT NULL OR v_listing.status = 'locked' THEN RAISE EXCEPTION 'Listing already locked'; END IF;

    UPDATE public.listings SET status = 'locked', locked_by = v.buyer_id, locked_at = now(), lock_expires_at = now() + interval '24 hours' WHERE id = v.listing_id;

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

  SELECT count(*) INTO v_active FROM public.connections c
  WHERE c.listing_id = v.listing_id AND c.seller_id = auth.uid() AND c.id <> p_connection_id
    AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');
  IF COALESCE(v_active, 0) > 0 THEN RAISE EXCEPTION 'This listing already has an active connection. End or finish it before accepting another request.'; END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = v.listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.status IN ('sold','removed') THEN RAISE EXCEPTION 'Listing not available'; END IF;
  IF v_listing.locked_by IS NULL OR v_listing.status <> 'locked' THEN RAISE EXCEPTION 'Listing already locked'; END IF;

  UPDATE public.listings SET status = 'locked', locked_by = v.buyer_id, locked_at = now(), lock_expires_at = now() + interval '24 hours' WHERE id = v.listing_id;

  SELECT array_agg(id) INTO v_q FROM (SELECT id FROM public.bonding_questions WHERE active = true ORDER BY random() LIMIT 3) s;
  UPDATE public.connections
  SET stage = 'bonding', stage_expires_at = now() + interval '24 hours', bonding_question_ids = COALESCE(v_q, '{}'::uuid[])
  WHERE id = p_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seller_respond_connection(uuid, boolean, boolean) TO authenticated;

-- 10) submit_bonding_answers: support buyer_bonding_v2 (buyer only, 2 questions)
DROP FUNCTION IF EXISTS public.submit_bonding_answers(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.submit_bonding_answers(p_connection_id uuid, p_answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
  v_q uuid[];
  v_needed int;
  v_seller_answers jsonb;
BEGIN
  SELECT * INTO v FROM public.connections WHERE id = p_connection_id FOR UPDATE;
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
    UPDATE public.connections
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
    UPDATE public.connections SET buyer_bonding_answers = p_answers, buyer_bonding_submitted_at = now() WHERE id = p_connection_id;
  ELSE
    UPDATE public.connections SET seller_bonding_answers = p_answers, seller_bonding_submitted_at = now() WHERE id = p_connection_id;
  END IF;

  UPDATE public.connections SET stage = 'preview', stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id AND buyer_bonding_submitted_at IS NOT NULL AND seller_bonding_submitted_at IS NOT NULL AND stage = 'bonding';
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bonding_answers(uuid, jsonb) TO authenticated;

-- 11) Timeouts: include buyer_bonding_v2
DROP FUNCTION IF EXISTS public.process_connection_timeouts();
CREATE OR REPLACE FUNCTION public.process_connection_timeouts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0;
BEGIN
  WITH expired AS (
    UPDATE public.connections c SET stage = 'expired', stage_expires_at = now()
    WHERE c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement') AND c.stage_expires_at < now()
    RETURNING c.listing_id
  )
  UPDATE public.listings l SET status = 'active', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE l.id IN (SELECT listing_id FROM expired);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_connection_timeouts() TO authenticated;

-- 12) Buyer trigger: count buyer_bonding_v2 as active
DROP FUNCTION IF EXISTS public.enforce_max_active_connections_per_buyer();
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
  PERFORM pg_advisory_xact_lock(hashtext(v_buyer::text));
  SELECT count(*) INTO v_count FROM public.connections c
  WHERE c.buyer_id = v_buyer AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (TG_OP <> 'UPDATE' OR c.id <> NEW.id);
  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 active connection requests. Please complete or end one before connecting to another listing.';
  END IF;
  RETURN NEW;
END;
$$;
