-- Merch categories and filters (Official, Fanmade, Collectibles + subcategories and optional filters).

-- 1) Categories table (two-level: category -> subcategory)
CREATE TABLE IF NOT EXISTS public.merch_categories (
  slug text PRIMARY KEY,
  label text NOT NULL,
  parent_slug text REFERENCES public.merch_categories(slug) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0
);

-- Top-level
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('official_merch', 'Official Merch', NULL, 1),
  ('fanmade', 'Fanmade Merch', NULL, 2),
  ('collectibles', 'Collectibles & Rare', NULL, 3),
  ('other', 'Other', NULL, 4)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Official Merch subcategories
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('official_albums', 'Albums', 'official_merch', 10),
  ('official_photocards', 'Photocards & Inclusions', 'official_merch', 11),
  ('official_dvds', 'DVDs / Blu-rays / Digital Codes', 'official_merch', 12),
  ('official_concert_tour', 'Concert & Tour Merch', 'official_merch', 13),
  ('official_lightsticks', 'Light Sticks', 'official_merch', 14),
  ('official_fashion', 'Fashion & Collabs', 'official_merch', 15),
  ('official_magazines', 'Magazines & Books', 'official_merch', 16)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Albums sub-sub (optional filter / subcategory)
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('albums_korean', 'Korean Albums', 'official_albums', 1),
  ('albums_japanese', 'Japanese Albums', 'official_albums', 2),
  ('albums_solo', 'Solo Albums (RM, Jin, SUGA, j-hope, Jimin, V, Jungkook)', 'official_albums', 3),
  ('albums_limited', 'Limited / Special Editions', 'official_albums', 4),
  ('albums_weverse', 'Weverse Exclusives', 'official_albums', 5)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Photocards & Inclusions sub
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('pc_album', 'Album Photocards', 'official_photocards', 1),
  ('pc_lucky_draw', 'Lucky Draw', 'official_photocards', 2),
  ('pc_pob', 'POB (Pre-Order Benefits)', 'official_photocards', 3),
  ('pc_broadcast', 'Broadcast PCs', 'official_photocards', 4),
  ('pc_fanmeeting', 'Fanmeeting PCs', 'official_photocards', 5),
  ('pc_dvd', 'DVD / Blu-ray PCs', 'official_photocards', 6),
  ('pc_polaroids', 'Polaroids', 'official_photocards', 7),
  ('pc_postcards', 'Postcards', 'official_photocards', 8),
  ('incl_stickers', 'Stickers', 'official_photocards', 9),
  ('incl_mini_posters', 'Mini posters', 'official_photocards', 10),
  ('incl_standees', 'Standees', 'official_photocards', 11),
  ('incl_other', 'Other inclusions', 'official_photocards', 12)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Concert & Tour sub
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('tour_tshirts', 'T-Shirts', 'official_concert_tour', 1),
  ('tour_hoodies', 'Hoodies / Apparel', 'official_concert_tour', 2),
  ('tour_bags', 'Bags', 'official_concert_tour', 3),
  ('tour_slogans', 'Slogans', 'official_concert_tour', 4),
  ('tour_premium_photos', 'Premium photos', 'official_concert_tour', 5),
  ('tour_other', 'Tour-specific items', 'official_concert_tour', 6)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Light Sticks sub
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('armybomb_v1', 'ARMY Bomb Ver. 1', 'official_lightsticks', 1),
  ('armybomb_v2', 'ARMY Bomb Ver. 2', 'official_lightsticks', 2),
  ('armybomb_v3', 'ARMY Bomb Ver. 3 (MOTS)', 'official_lightsticks', 3),
  ('armybomb_special', 'Special Editions', 'official_lightsticks', 4),
  ('armybomb_accessories', 'Accessories (stickers, straps)', 'official_lightsticks', 5)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Fanmade subcategories
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('fanmade_photocards', 'Fanmade Photocards', 'fanmade', 1),
  ('fanmade_apparel', 'Fanmade Apparel', 'fanmade', 2),
  ('fanmade_handmade', 'Handmade Items', 'fanmade', 3),
  ('fanmade_art_prints', 'Art Prints / Posters', 'fanmade', 4),
  ('fanmade_stickers', 'Stickers', 'fanmade', 5),
  ('fanmade_custom', 'Custom Merch', 'fanmade', 6)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Handmade sub
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('handmade_keychains', 'Keychains', 'fanmade_handmade', 1),
  ('handmade_pins', 'Pins', 'fanmade_handmade', 2),
  ('handmade_bracelets', 'Bracelets', 'fanmade_handmade', 3),
  ('handmade_crochet', 'Crochet / custom items', 'fanmade_handmade', 4)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Collectibles subcategories
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('collectibles_rare', 'Rare / Out of Print', 'collectibles', 1),
  ('collectibles_signed', 'Signed Items', 'collectibles', 2),
  ('collectibles_broadcast', 'Broadcast / Event Exclusive', 'collectibles', 3),
  ('collectibles_limited', 'Limited Edition', 'collectibles', 4)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- 2) Add columns to merch_listings
ALTER TABLE public.merch_listings
  ADD COLUMN IF NOT EXISTS category_slug text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS subcategory_slug text,
  ADD COLUMN IF NOT EXISTS is_fanmade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fanmade_disclaimer_accepted boolean,
  ADD COLUMN IF NOT EXISTS filter_options jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proof_url text;

COMMENT ON COLUMN public.merch_listings.category_slug IS 'Top-level or leaf category slug from merch_categories';
COMMENT ON COLUMN public.merch_listings.subcategory_slug IS 'Optional subcategory slug (e.g. album type under official_albums)';
COMMENT ON COLUMN public.merch_listings.is_fanmade IS 'True when category is under fanmade; requires fanmade disclaimer';
COMMENT ON COLUMN public.merch_listings.fanmade_disclaimer_accepted IS 'User must accept: This is fanmade and not official BTS merch';
COMMENT ON COLUMN public.merch_listings.filter_options IS 'Optional filters: sealed, with_inclusions, member, tour, condition, official_replica, version, etc.';
COMMENT ON COLUMN public.merch_listings.proof_url IS 'Optional proof image URL for signed/broadcast/rare claims';

-- Constraint: fanmade listings must have disclaimer accepted
ALTER TABLE public.merch_listings
  DROP CONSTRAINT IF EXISTS merch_listings_fanmade_disclaimer;
ALTER TABLE public.merch_listings
  ADD CONSTRAINT merch_listings_fanmade_disclaimer
  CHECK (NOT is_fanmade OR (fanmade_disclaimer_accepted = true));

-- Optional FK to categories (allow any slug for flexibility; app validates)
-- CREATE INDEX for browse filter
CREATE INDEX IF NOT EXISTS idx_merch_listings_category ON public.merch_listings(category_slug);
CREATE INDEX IF NOT EXISTS idx_merch_listings_subcategory ON public.merch_listings(subcategory_slug);
CREATE INDEX IF NOT EXISTS idx_merch_listings_is_fanmade ON public.merch_listings(is_fanmade);

-- 3) RPC to list categories for UI (tree or flat)
CREATE OR REPLACE FUNCTION public.get_merch_categories()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(c ORDER BY c.sort_order, c.slug), '[]'::json)
  FROM (
    SELECT slug, label, parent_slug, sort_order
    FROM public.merch_categories
  ) c;
$$;
GRANT EXECUTE ON FUNCTION public.get_merch_categories() TO anon;
GRANT EXECUTE ON FUNCTION public.get_merch_categories() TO authenticated;

-- 4) browse_merch_listings: return new columns and optional category/subcategory filter
CREATE OR REPLACE FUNCTION public.browse_merch_listings(
  p_category_slug text DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL
)
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
  created_at timestamptz,
  category_slug text,
  subcategory_slug text,
  is_fanmade boolean,
  filter_options jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.seller_id, m.title, m.description, m.quantity, m.price, m.currency, m.images, m.status, m.created_at,
         m.category_slug, m.subcategory_slug, m.is_fanmade, m.filter_options
  FROM public.merch_listings m
  WHERE m.status IN ('active','locked','sold')
    AND (p_category_slug IS NULL OR p_category_slug = '' OR m.category_slug = p_category_slug OR EXISTS (SELECT 1 FROM public.merch_categories c WHERE c.slug = m.category_slug AND c.parent_slug = p_category_slug))
    AND (p_subcategory_slug IS NULL OR p_subcategory_slug = '' OR m.subcategory_slug = p_subcategory_slug OR m.category_slug = p_subcategory_slug)
  ORDER BY
    CASE m.status WHEN 'active' THEN 1 WHEN 'locked' THEN 2 WHEN 'sold' THEN 3 ELSE 4 END,
    m.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.browse_merch_listings(text, text) TO authenticated;

-- 5) create_merch_listing: add category, subcategory, is_fanmade, disclaimer, filter_options, proof_url
CREATE OR REPLACE FUNCTION public.create_merch_listing(
  p_title text,
  p_description text,
  p_quantity int,
  p_price numeric,
  p_currency text DEFAULT 'USD',
  p_images text[] DEFAULT '{}',
  p_category_slug text DEFAULT 'other',
  p_subcategory_slug text DEFAULT NULL,
  p_is_fanmade boolean DEFAULT false,
  p_fanmade_disclaimer_accepted boolean DEFAULT false,
  p_filter_options jsonb DEFAULT '{}',
  p_proof_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_listing_id uuid;
BEGIN
  v_seller_id := auth.uid();
  IF v_seller_id IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  IF NULLIF(trim(p_title), '') IS NULL THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;
  IF p_price IS NULL OR p_price < 0 THEN RAISE EXCEPTION 'Price must be 0 or more'; END IF;
  IF p_images IS NULL THEN p_images := '{}'; END IF;
  IF p_is_fanmade AND NOT COALESCE(p_fanmade_disclaimer_accepted, false) THEN
    RAISE EXCEPTION 'You must accept the fanmade disclaimer for fanmade items';
  END IF;

  INSERT INTO public.merch_listings (
    seller_id, title, description, quantity, price, currency, images, status,
    category_slug, subcategory_slug, is_fanmade, fanmade_disclaimer_accepted, filter_options, proof_url
  )
  VALUES (
    v_seller_id, trim(p_title), NULLIF(trim(p_description), ''), p_quantity, p_price,
    COALESCE(NULLIF(trim(p_currency), ''), 'USD'), p_images, 'active',
    COALESCE(NULLIF(trim(p_category_slug), ''), 'other'),
    NULLIF(trim(p_subcategory_slug), ''),
    COALESCE(p_is_fanmade, false),
    CASE WHEN COALESCE(p_is_fanmade, false) THEN COALESCE(p_fanmade_disclaimer_accepted, false) ELSE NULL END,
    COALESCE(p_filter_options, '{}'::jsonb),
    NULLIF(trim(p_proof_url), '')
  )
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_merch_listing(text, text, int, numeric, text, text[], text, text, boolean, boolean, jsonb, text) TO authenticated;
