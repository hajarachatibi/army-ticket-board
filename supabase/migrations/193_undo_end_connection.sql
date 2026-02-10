-- Allow undoing "end connection" by the person who ended it, within a short window.
-- 1) Add columns to remember who ended and the stage before ending.
-- 2) end_connection sets these so undo_end_connection can restore.
-- 3) undo_end_connection restores the connection and notifies the other party.

ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS ended_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage_before_ended text;

-- Allow ending from buyer_bonding_v2 as well (consistent with active stages).
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

  -- Store who ended and which stage so we can undo.
  UPDATE public.connections
  SET stage = 'ended',
      stage_expires_at = now(),
      ended_by = auth.uid(),
      ended_at = now(),
      stage_before_ended = v.stage
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');

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

-- Undo: only the person who ended can undo, within 1 hour.
CREATE OR REPLACE FUNCTION public.undo_end_connection(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.stage <> 'ended' THEN RAISE EXCEPTION 'Connection is not ended'; END IF;
  IF v.ended_by IS NULL OR v.ended_by <> auth.uid() THEN RAISE EXCEPTION 'Only the person who ended the connection can undo'; END IF;
  IF v.ended_at IS NULL OR v.ended_at < now() - interval '1 hour' THEN RAISE EXCEPTION 'Undo is only available for 1 hour after ending'; END IF;
  IF v.stage_before_ended IS NULL OR v.stage_before_ended NOT IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open') THEN
    RAISE EXCEPTION 'Cannot restore this connection';
  END IF;

  SELECT trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
  INTO v_summary
  FROM public.listings l
  WHERE l.id = v.listing_id;
  v_summary := COALESCE(NULLIF(trim(v_summary), ''), 'Listing');

  v_expires_at := now() + interval '24 hours';

  UPDATE public.connections
  SET stage = v.stage_before_ended,
      stage_expires_at = v_expires_at,
      ended_by = NULL,
      ended_at = NULL,
      stage_before_ended = NULL
  WHERE id = p_connection_id;

  PERFORM public.recompute_listing_lock(v.listing_id);

  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  PERFORM public.notify_user(
    v_notify_user_id,
    'connection_undid_end',
    CASE
      WHEN auth.uid() = v.seller_id THEN 'The seller undid ending the connection. The connection is active again.'
      ELSE 'The buyer undid ending the connection. The connection is active again.'
    END,
    NULL,
    NULL,
    v.listing_id,
    v_summary,
    p_connection_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_end_connection(uuid) TO authenticated;

COMMENT ON FUNCTION public.undo_end_connection(uuid) IS
'Restore a connection that was just ended by the current user. Allowed only within 1 hour and only by the user who ended it. Notifies the other party.';
