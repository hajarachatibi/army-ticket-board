-- Merch: separate tables for merch listings (quantity, pics) and merch connections.
-- Same flow as tickets (bonding, preview, socials, agreement, chat) but:
-- - Sellers: no limit on number of merch listings.
-- - Buyers/sellers: no limit on connections.
-- - Listing lock: when active connections >= 3 * quantity, listing becomes locked.

-- 1) merch_listings
CREATE TABLE IF NOT EXISTS public.merch_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  quantity int NOT NULL CHECK (quantity >= 1),
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'USD',
  images text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked','sold','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merch_listings_seller ON public.merch_listings(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merch_listings_status ON public.merch_listings(status);

DROP TRIGGER IF EXISTS merch_listings_updated_at ON public.merch_listings;
CREATE TRIGGER merch_listings_updated_at
  BEFORE UPDATE ON public.merch_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.merch_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merch_listings_select_own"
  ON public.merch_listings FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "merch_listings_insert_own"
  ON public.merch_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "merch_listings_update_own"
  ON public.merch_listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

CREATE POLICY "merch_listings_delete_own"
  ON public.merch_listings FOR DELETE TO authenticated
  USING (seller_id = auth.uid());

-- Browse: anyone authenticated can read active/locked/sold merch listings (for All Listings tab)
CREATE POLICY "merch_listings_select_browse"
  ON public.merch_listings FOR SELECT TO authenticated
  USING (true);

-- 2) merch_connections (mirror connections flow; same stages, no buyer/seller limits)
CREATE TABLE IF NOT EXISTS public.merch_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merch_listing_id uuid NOT NULL REFERENCES public.merch_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'pending_seller'
    CHECK (stage IN ('pending_seller','declined','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open','ended','expired')),
  stage_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  bonding_question_ids uuid[] NOT NULL DEFAULT '{}',
  buyer_bonding_answers jsonb NOT NULL DEFAULT '{}',
  seller_bonding_answers jsonb NOT NULL DEFAULT '{}',
  buyer_bonding_submitted_at timestamptz,
  seller_bonding_submitted_at timestamptz,
  buyer_comfort boolean,
  seller_comfort boolean,
  buyer_want_social_share boolean,
  buyer_social_share boolean,
  seller_social_share boolean,
  buyer_agreed boolean NOT NULL DEFAULT false,
  seller_agreed boolean NOT NULL DEFAULT false,
  ended_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ended_at timestamptz,
  stage_before_ended text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merch_connections_listing ON public.merch_connections(merch_listing_id);
CREATE INDEX IF NOT EXISTS idx_merch_connections_buyer ON public.merch_connections(buyer_id, stage);
CREATE INDEX IF NOT EXISTS idx_merch_connections_seller ON public.merch_connections(seller_id, stage);

DROP TRIGGER IF EXISTS merch_connections_updated_at ON public.merch_connections;
CREATE TRIGGER merch_connections_updated_at
  BEFORE UPDATE ON public.merch_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.merch_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merch_connections_select_participants"
  ON public.merch_connections FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "merch_connections_insert_buyer"
  ON public.merch_connections FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "merch_connections_update_participants"
  ON public.merch_connections FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- 3) Recompute merch listing lock: locked when active_connections >= 3 * quantity
CREATE OR REPLACE FUNCTION public.recompute_merch_listing_lock(p_merch_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active int;
  v_quantity int;
  v_status text;
BEGIN
  IF p_merch_listing_id IS NULL THEN RETURN; END IF;

  SELECT quantity, status INTO v_quantity, v_status
  FROM public.merch_listings
  WHERE id = p_merch_listing_id
  FOR UPDATE;

  IF v_quantity IS NULL OR v_status IN ('sold', 'removed') THEN RETURN; END IF;

  SELECT count(*) INTO v_active
  FROM public.merch_connections c
  WHERE c.merch_listing_id = p_merch_listing_id
    AND c.stage IN (
      'pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open'
    )
    AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());

  IF COALESCE(v_active, 0) >= 3 * v_quantity THEN
    UPDATE public.merch_listings SET status = 'locked' WHERE id = p_merch_listing_id AND status = 'active';
  ELSE
    UPDATE public.merch_listings SET status = 'active' WHERE id = p_merch_listing_id AND status = 'locked';
  END IF;
END;
$$;

-- 4) RPC: browse merch listings (for All Listings tab)
CREATE OR REPLACE FUNCTION public.browse_merch_listings()
RETURNS TABLE (
  id uuid,
  seller_id uuid,
  title text,
  description text,
  quantity int,
  price numeric,
  currency text,
  images text[],
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.seller_id, m.title, m.description, m.quantity, m.price, m.currency, m.images, m.status, m.created_at
  FROM public.merch_listings m
  WHERE m.status IN ('active','locked','sold')
  ORDER BY
    CASE m.status WHEN 'active' THEN 1 WHEN 'locked' THEN 2 WHEN 'sold' THEN 3 ELSE 4 END,
    m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.browse_merch_listings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_merch_listing_lock(uuid) TO authenticated;

COMMENT ON TABLE public.merch_listings IS 'Merch listings with quantity and images. Lock when active connections >= 3 * quantity.';
COMMENT ON TABLE public.merch_connections IS 'Merch connection flow (same stages as tickets). No per-buyer or per-seller connection limits.';
