-- Merch: undo end connection (same as tickets) + buyer rate seller (merch_connection_ratings).

-- 1) undo_merch_connection: restore connection ended by current user within 1 hour
CREATE OR REPLACE FUNCTION public.undo_merch_connection(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v
  FROM public.merch_connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.stage <> 'ended' THEN RAISE EXCEPTION 'Connection is not ended'; END IF;
  IF v.ended_by IS NULL OR v.ended_by <> auth.uid() THEN RAISE EXCEPTION 'Only the person who ended the connection can undo'; END IF;
  IF v.ended_at IS NULL OR v.ended_at < now() - interval '1 hour' THEN RAISE EXCEPTION 'Undo is only available for 1 hour after ending'; END IF;
  IF v.stage_before_ended IS NULL OR v.stage_before_ended NOT IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open') THEN
    RAISE EXCEPTION 'Cannot restore this connection';
  END IF;

  SELECT COALESCE(NULLIF(trim(ml.title), ''), 'Merch listing')
  INTO v_summary
  FROM public.merch_listings ml
  WHERE ml.id = v.merch_listing_id;

  v_expires_at := now() + interval '24 hours';

  UPDATE public.merch_connections
  SET stage = v.stage_before_ended,
      stage_expires_at = v_expires_at,
      ended_by = NULL,
      ended_at = NULL,
      stage_before_ended = NULL
  WHERE id = p_connection_id;

  PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);

  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  BEGIN
    PERFORM public.notify_user_merch(
      v_notify_user_id,
      'connection_undid_end',
      CASE
        WHEN auth.uid() = v.seller_id THEN 'The seller undid ending the connection. The connection is active again.'
        ELSE 'The buyer undid ending the connection. The connection is active again.'
      END,
      v.merch_listing_id,
      v_summary,
      p_connection_id
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_merch_connection(uuid) TO authenticated;

COMMENT ON FUNCTION public.undo_merch_connection(uuid) IS 'Restore a merch connection that was just ended by the current user. Allowed only within 1 hour. Notifies the other party.';

-- 2) merch_connection_ratings: buyer rates seller (same shape as connection_ratings)
CREATE TABLE IF NOT EXISTS public.merch_connection_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merch_connection_id uuid NOT NULL REFERENCES public.merch_connections(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(merch_connection_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_merch_connection_ratings_connection ON public.merch_connection_ratings(merch_connection_id);
CREATE INDEX IF NOT EXISTS idx_merch_connection_ratings_rated ON public.merch_connection_ratings(rated_id);

ALTER TABLE public.merch_connection_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merch_connection_ratings_select_own" ON public.merch_connection_ratings;
CREATE POLICY "merch_connection_ratings_select_own"
  ON public.merch_connection_ratings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merch_connections c
      WHERE c.id = merch_connection_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "merch_connection_ratings_insert_buyer" ON public.merch_connection_ratings;
CREATE POLICY "merch_connection_ratings_insert_buyer"
  ON public.merch_connection_ratings FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.merch_connections c
      WHERE c.id = merch_connection_id
        AND c.buyer_id = auth.uid()
        AND c.seller_id = rated_id
        AND c.stage IN ('chat_open', 'ended')
    )
  );

CREATE OR REPLACE FUNCTION public.submit_merch_connection_rating(p_connection_id uuid, p_rating smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO v
  FROM public.merch_connections
  WHERE id = p_connection_id;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can rate the seller'; END IF;
  IF v.stage NOT IN ('chat_open', 'ended') THEN
    RAISE EXCEPTION 'Connection must be completed before rating';
  END IF;

  INSERT INTO public.merch_connection_ratings (merch_connection_id, rater_id, rated_id, rating)
  VALUES (p_connection_id, v.buyer_id, v.seller_id, p_rating)
  ON CONFLICT (merch_connection_id, rater_id) DO UPDATE SET rating = EXCLUDED.rating, created_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_merch_connection_rating(uuid, smallint) TO authenticated;

COMMENT ON TABLE public.merch_connection_ratings IS 'Buyer rates seller after merch connection completes; one rating per connection.';
