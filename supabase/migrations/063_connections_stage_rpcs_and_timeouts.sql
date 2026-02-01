-- Connection stage RPCs + automatic timeout processing.

-- Submit bonding answers (buyer/seller)
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
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid());
  v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage <> 'bonding' THEN RAISE EXCEPTION 'Not in bonding stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Bonding expired'; END IF;

  v_q := COALESCE(v.bonding_question_ids, '{}'::uuid[]);
  v_needed := array_length(v_q, 1);
  IF v_needed IS NULL OR v_needed <> 3 THEN
    RAISE EXCEPTION 'Bonding questions not initialized';
  END IF;

  -- Require all 3 answers present.
  IF jsonb_typeof(p_answers) <> 'object' THEN RAISE EXCEPTION 'Invalid answers'; END IF;

  IF NOT (
    p_answers ? (v_q[1]::text)
    AND p_answers ? (v_q[2]::text)
    AND p_answers ? (v_q[3]::text)
  ) THEN
    RAISE EXCEPTION 'All bonding questions must be answered';
  END IF;

  IF v_is_buyer THEN
    UPDATE public.connections
    SET buyer_bonding_answers = p_answers,
        buyer_bonding_submitted_at = now()
    WHERE id = p_connection_id;
  ELSE
    UPDATE public.connections
    SET seller_bonding_answers = p_answers,
        seller_bonding_submitted_at = now()
    WHERE id = p_connection_id;
  END IF;

  -- If both answered, move to preview stage (comfort decision happens there).
  UPDATE public.connections
  SET stage = 'preview',
      stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id
    AND buyer_bonding_submitted_at IS NOT NULL
    AND seller_bonding_submitted_at IS NOT NULL
    AND stage = 'bonding';
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bonding_answers(uuid, jsonb) TO authenticated;

-- Comfort decision (buyer/seller)
DROP FUNCTION IF EXISTS public.set_comfort_decision(uuid, boolean);
CREATE OR REPLACE FUNCTION public.set_comfort_decision(p_connection_id uuid, p_comfort boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid());
  v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage <> 'preview' THEN RAISE EXCEPTION 'Not in preview stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Preview expired'; END IF;

  IF v_is_buyer THEN
    UPDATE public.connections SET buyer_comfort = p_comfort WHERE id = p_connection_id;
  ELSE
    UPDATE public.connections SET seller_comfort = p_comfort WHERE id = p_connection_id;
  END IF;

  -- If either says no, end and unlock.
  IF (COALESCE((SELECT buyer_comfort FROM public.connections WHERE id = p_connection_id), true) = false)
     OR (COALESCE((SELECT seller_comfort FROM public.connections WHERE id = p_connection_id), true) = false) THEN
    UPDATE public.connections SET stage = 'ended', stage_expires_at = now() WHERE id = p_connection_id;
    UPDATE public.listings
    SET status = 'active', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
    WHERE id = v.listing_id;
    RETURN;
  END IF;

  -- If both said yes, move to social.
  UPDATE public.connections
  SET stage = 'social',
      stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id
    AND buyer_comfort = true
    AND seller_comfort = true
    AND stage = 'preview';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_comfort_decision(uuid, boolean) TO authenticated;

-- Social share decision
DROP FUNCTION IF EXISTS public.set_social_share_decision(uuid, boolean);
CREATE OR REPLACE FUNCTION public.set_social_share_decision(p_connection_id uuid, p_share boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid());
  v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage <> 'social' THEN RAISE EXCEPTION 'Not in social stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Social step expired'; END IF;

  IF v_is_buyer THEN
    UPDATE public.connections SET buyer_social_share = p_share WHERE id = p_connection_id;
  ELSE
    UPDATE public.connections SET seller_social_share = p_share WHERE id = p_connection_id;
  END IF;

  -- Move to agreement once both decided (yes OR no).
  UPDATE public.connections
  SET stage = 'agreement',
      stage_expires_at = now() + interval '24 hours'
  WHERE id = p_connection_id
    AND buyer_social_share IS NOT NULL
    AND seller_social_share IS NOT NULL
    AND stage = 'social';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_social_share_decision(uuid, boolean) TO authenticated;

-- Agreement acceptance
DROP FUNCTION IF EXISTS public.accept_connection_agreement(uuid);
CREATE OR REPLACE FUNCTION public.accept_connection_agreement(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_is_buyer boolean;
  v_is_seller boolean;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  v_is_buyer := (v.buyer_id = auth.uid());
  v_is_seller := (v.seller_id = auth.uid());
  IF NOT (v_is_buyer OR v_is_seller) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF v.stage <> 'agreement' THEN RAISE EXCEPTION 'Not in agreement stage'; END IF;
  IF now() > v.stage_expires_at THEN RAISE EXCEPTION 'Agreement expired'; END IF;

  IF v_is_buyer THEN
    UPDATE public.connections SET buyer_agreed = true WHERE id = p_connection_id;
  ELSE
    UPDATE public.connections SET seller_agreed = true WHERE id = p_connection_id;
  END IF;

  -- If both agreed, open chat (chat row is created by the app server, but mark stage here).
  UPDATE public.connections
  SET stage = 'chat_open',
      stage_expires_at = now() + interval '7 days'
  WHERE id = p_connection_id
    AND buyer_agreed = true
    AND seller_agreed = true
    AND stage = 'agreement';
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_connection_agreement(uuid) TO authenticated;

-- Process timeouts (call via server cron).
DROP FUNCTION IF EXISTS public.process_connection_timeouts();
CREATE OR REPLACE FUNCTION public.process_connection_timeouts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Expire connections whose stage timed out (not chat_open).
  WITH expired AS (
    UPDATE public.connections c
    SET stage = 'expired',
        stage_expires_at = now()
    WHERE c.stage IN ('pending_seller','bonding','preview','comfort','social','agreement')
      AND c.stage_expires_at < now()
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

