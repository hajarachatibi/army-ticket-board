-- Self-sufficient flow: listings + connection pipeline (no admin approvals).

-- =============================================================================
-- 1) Bonding questions pool (emotional / experience, not trivia)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bonding_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonding_questions_active ON public.bonding_questions(active, created_at);

DROP TRIGGER IF EXISTS bonding_questions_updated_at ON public.bonding_questions;
CREATE TRIGGER bonding_questions_updated_at
  BEFORE UPDATE ON public.bonding_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed (idempotent)
INSERT INTO public.bonding_questions (prompt, active)
SELECT v.prompt, true
FROM (
  VALUES
    ('What BTS moment helped you during a hard time?', true),
    ('Which BTS lyric feels like it was written for you, and why?', true),
    ('What is a BTS performance you can watch forever?', true),
    ('How did you first discover BTS?', true),
    ('What does being ARMY mean to you personally?', true),
    ('Which BTS era feels most special to you and why?', true),
    ('What is your favorite BTS memory with friends or family?', true),
    ('What is a BTS song you recommend to someone who feels alone?', true),
    ('Which member inspires you most right now, and why?', true),
    ('What is one thing BTS taught you about yourself?', true),
    ('What is your comfort BTS song and what does it remind you of?', true),
    ('If you could tell BTS one sentence, what would it be?', true),
    ('What is a small ARMY kindness you experienced?', true),
    ('What is a BTS message you carry with you daily?', true),
    ('What is your favorite BTS album and the story behind it?', true)
) AS v(prompt, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bonding_questions q WHERE q.prompt = v.prompt
);

ALTER TABLE public.bonding_questions ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active bonding questions (needed for answering).
DROP POLICY IF EXISTS "bonding_questions_select_active" ON public.bonding_questions;
CREATE POLICY "bonding_questions_select_active"
  ON public.bonding_questions FOR SELECT
  TO authenticated
  USING (active = true);

-- =============================================================================
-- 2) Listings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  concert_city text NOT NULL,
  concert_date date NOT NULL,
  ticket_source text NOT NULL CHECK (ticket_source IN ('Ticketmaster','Seatgeek','StubHub','Viagogo','Interpark','Other')),
  ticketing_experience text NOT NULL,
  selling_reason text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','active','locked','sold','removed')),
  processing_until timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  locked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_seller ON public.listings(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status, processing_until);

DROP TRIGGER IF EXISTS listings_updated_at ON public.listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only one active listing per seller at a time (processing/active/locked).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_listings_one_active_per_seller
  ON public.listings(seller_id)
  WHERE status IN ('processing','active','locked');

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Seller can manage their own listing.
DROP POLICY IF EXISTS "listings_select_own" ON public.listings;
CREATE POLICY "listings_select_own"
  ON public.listings FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
CREATE POLICY "listings_insert_own"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
CREATE POLICY "listings_update_own"
  ON public.listings FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "listings_delete_own" ON public.listings;
CREATE POLICY "listings_delete_own"
  ON public.listings FOR DELETE
  TO authenticated
  USING (seller_id = auth.uid());

-- =============================================================================
-- 3) Listing seats (up to 4 seats per listing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.listing_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seat_index int NOT NULL CHECK (seat_index BETWEEN 1 AND 4),
  section text NOT NULL,
  seat_row text NOT NULL,
  seat text NOT NULL,
  face_value_price numeric NOT NULL CHECK (face_value_price >= 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_listing_seats_index ON public.listing_seats(listing_id, seat_index);
CREATE INDEX IF NOT EXISTS idx_listing_seats_listing ON public.listing_seats(listing_id);

ALTER TABLE public.listing_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_seats_select_own" ON public.listing_seats;
CREATE POLICY "listing_seats_select_own"
  ON public.listing_seats FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

DROP POLICY IF EXISTS "listing_seats_insert_own" ON public.listing_seats;
CREATE POLICY "listing_seats_insert_own"
  ON public.listing_seats FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

DROP POLICY IF EXISTS "listing_seats_delete_own" ON public.listing_seats;
CREATE POLICY "listing_seats_delete_own"
  ON public.listing_seats FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

-- =============================================================================
-- 4) Connections (Connect -> bonding -> preview -> socials -> agreement -> chat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'pending_seller' CHECK (stage IN ('pending_seller','declined','bonding','preview','social','agreement','chat_open','ended','expired')),
  stage_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  bonding_question_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  buyer_bonding_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller_bonding_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  buyer_bonding_submitted_at timestamptz,
  seller_bonding_submitted_at timestamptz,
  buyer_comfort boolean,
  seller_comfort boolean,
  buyer_social_share boolean,
  seller_social_share boolean,
  buyer_agreed boolean NOT NULL DEFAULT false,
  seller_agreed boolean NOT NULL DEFAULT false,
  chat_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connections_buyer_stage ON public.connections(buyer_id, stage, stage_expires_at);
CREATE INDEX IF NOT EXISTS idx_connections_seller_stage ON public.connections(seller_id, stage, stage_expires_at);

-- Buyer can only have one active connection at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_connections_one_active_per_buyer
  ON public.connections(buyer_id)
  WHERE stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');

DROP TRIGGER IF EXISTS connections_updated_at ON public.connections;
CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_select_participants" ON public.connections;
CREATE POLICY "connections_select_participants"
  ON public.connections FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- =============================================================================
-- 5) RPCs (atomic locking + stage transitions)
-- =============================================================================

DROP FUNCTION IF EXISTS public.connect_to_listing(uuid);
CREATE OR REPLACE FUNCTION public.connect_to_listing(p_listing_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_connection_id uuid;
BEGIN
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_listing.status IN ('sold','removed') THEN
    RAISE EXCEPTION 'Listing not available';
  END IF;

  IF now() < v_listing.processing_until THEN
    RAISE EXCEPTION 'Listing is still processing';
  END IF;

  IF v_listing.locked_by IS NOT NULL THEN
    RAISE EXCEPTION 'Listing already locked';
  END IF;

  IF v_listing.seller_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot connect to your own listing';
  END IF;

  -- Ensure buyer has onboarding completed and terms accepted (user agreement text will be provided later).
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = auth.uid()
      AND p.onboarding_completed_at IS NOT NULL
      AND p.terms_accepted_at IS NOT NULL
      AND p.user_agreement_accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding and agreements first';
  END IF;

  -- Enforce one active connection per buyer (index will also enforce; this gives a clear message).
  IF EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.buyer_id = auth.uid()
      AND c.stage IN ('pending_seller','bonding','preview','social','agreement','chat_open')
  ) THEN
    RAISE EXCEPTION 'You already have an active connection';
  END IF;

  -- Lock listing + create connection
  UPDATE public.listings
  SET status = 'locked',
      locked_by = auth.uid(),
      locked_at = now(),
      lock_expires_at = now() + interval '24 hours'
  WHERE id = p_listing_id;

  INSERT INTO public.connections (listing_id, buyer_id, seller_id, stage, stage_expires_at)
  VALUES (p_listing_id, auth.uid(), v_listing.seller_id, 'pending_seller', now() + interval '24 hours')
  RETURNING id INTO v_connection_id;

  RETURN v_connection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_to_listing(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.seller_respond_connection(uuid, boolean);
CREATE OR REPLACE FUNCTION public.seller_respond_connection(p_connection_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_q uuid[];
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF v.seller_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v.stage <> 'pending_seller' THEN
    RAISE EXCEPTION 'Connection not in pending state';
  END IF;

  IF now() > v.stage_expires_at THEN
    RAISE EXCEPTION 'Connection expired';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.connections
    SET stage = 'declined',
        stage_expires_at = now()
    WHERE id = p_connection_id;

    UPDATE public.listings
    SET status = 'active',
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = v.listing_id;
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.seller_respond_connection(uuid, boolean) TO authenticated;

