-- Ensure end_merch_connection commits the UPDATE even if notification fails (e.g. constraint or missing column).

CREATE OR REPLACE FUNCTION public.end_merch_connection(p_connection_id uuid, p_ended_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_message text;
  v_rows int;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT COALESCE(NULLIF(trim(ml.title), ''), 'Merch listing')
  INTO v_summary
  FROM public.merch_listings ml
  WHERE ml.id = v.merch_listing_id;

  UPDATE public.merch_connections
  SET stage = 'ended', stage_expires_at = now(),
      ended_by = auth.uid(), ended_at = now(), stage_before_ended = v.stage
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN;
  END IF;

  PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);

  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  v_message := COALESCE(
    NULLIF(trim(p_ended_reason), ''),
    CASE
      WHEN auth.uid() = v.seller_id THEN 'The seller ended the connection.'
      ELSE 'The buyer ended the connection.'
    END
  );

  BEGIN
    PERFORM public.notify_user_merch(
      v_notify_user_id,
      'connection_ended',
      v_message,
      v.merch_listing_id,
      v_summary,
      p_connection_id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.end_merch_connection(uuid, text) IS 'End a merch connection; recomputes listing lock. Notification failure does not roll back the end.';
