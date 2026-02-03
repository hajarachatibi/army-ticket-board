-- Optional rating of the seller by the buyer after a connection reaches the final stage (socials exchanged).
-- One rating per connection (buyer rates seller). For future use (e.g. seller reputation).

CREATE TABLE IF NOT EXISTS public.connection_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rated_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_connection_ratings_connection ON public.connection_ratings(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_ratings_rated ON public.connection_ratings(rated_id);

ALTER TABLE public.connection_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connection_ratings_select_own_connection" ON public.connection_ratings;
CREATE POLICY "connection_ratings_select_own_connection"
  ON public.connection_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = connection_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "connection_ratings_insert_buyer" ON public.connection_ratings;
CREATE POLICY "connection_ratings_insert_buyer"
  ON public.connection_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.id = connection_id
        AND c.buyer_id = auth.uid()
        AND c.seller_id = rated_id
        AND c.stage IN ('chat_open', 'ended')
    )
  );

-- Submit rating: buyer rates seller. Only one rating per connection from the buyer.
DROP FUNCTION IF EXISTS public.submit_connection_rating(uuid, smallint);
CREATE OR REPLACE FUNCTION public.submit_connection_rating(p_connection_id uuid, p_rating smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF v.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Only the buyer can rate the seller'; END IF;
  IF v.stage NOT IN ('chat_open', 'ended') THEN
    RAISE EXCEPTION 'Connection must be completed before rating';
  END IF;

  INSERT INTO public.connection_ratings (connection_id, rater_id, rated_id, rating)
  VALUES (p_connection_id, v.buyer_id, v.seller_id, p_rating)
  ON CONFLICT (connection_id, rater_id) DO UPDATE SET rating = EXCLUDED.rating, created_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_connection_rating(uuid, smallint) TO authenticated;
