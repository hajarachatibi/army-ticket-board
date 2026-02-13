-- Add collection/event filter to merch browse (filter_options->>'collection_event').

CREATE OR REPLACE FUNCTION public.browse_merch_listings(
  p_category_slug text DEFAULT NULL,
  p_subcategory_slug text DEFAULT NULL,
  p_filter_sealed text DEFAULT NULL,
  p_filter_member text DEFAULT NULL,
  p_filter_tour text DEFAULT NULL,
  p_filter_condition text DEFAULT NULL,
  p_filter_official_replica text DEFAULT NULL,
  p_filter_collection_event text DEFAULT NULL
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
    AND (p_filter_sealed IS NULL OR p_filter_sealed = '' OR (m.filter_options->>'sealed') = p_filter_sealed)
    AND (p_filter_member IS NULL OR p_filter_member = '' OR (m.filter_options->>'member') = p_filter_member)
    AND (p_filter_tour IS NULL OR p_filter_tour = '' OR (m.filter_options->>'tour') = p_filter_tour)
    AND (p_filter_condition IS NULL OR p_filter_condition = '' OR (m.filter_options->>'condition') = p_filter_condition)
    AND (p_filter_official_replica IS NULL OR p_filter_official_replica = '' OR (m.filter_options->>'official_replica') = p_filter_official_replica)
    AND (p_filter_collection_event IS NULL OR p_filter_collection_event = '' OR (m.filter_options->>'collection_event') = p_filter_collection_event)
  ORDER BY
    CASE m.status WHEN 'active' THEN 1 WHEN 'locked' THEN 2 WHEN 'sold' THEN 3 ELSE 4 END,
    m.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.browse_merch_listings(text, text, text, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.browse_merch_listings(text, text, text, text, text, text, text, text) IS 'Browse merch listings with optional category and filter_options filters; collection_event is Run BTS, Bon Voyage, Tour name, etc.';
