-- Add BT21 (Official) category and subcategories for merch.

-- Top-level: BT21 (Official) - sort after Official Merch, before Fanmade
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('bt21_official', 'BT21 (Official)', NULL, 2)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

-- Bump fanmade and collectibles sort_order so BT21 sits between official_merch and fanmade
UPDATE public.merch_categories SET sort_order = 3 WHERE slug = 'fanmade';
UPDATE public.merch_categories SET sort_order = 4 WHERE slug = 'collectibles';
UPDATE public.merch_categories SET sort_order = 5 WHERE slug = 'other';

-- BT21 subcategories
INSERT INTO public.merch_categories (slug, label, parent_slug, sort_order) VALUES
  ('bt21_plush_dolls', 'Plush / Dolls', 'bt21_official', 10),
  ('bt21_stationery', 'Stationery', 'bt21_official', 11),
  ('bt21_apparel', 'Apparel', 'bt21_official', 12),
  ('bt21_home_lifestyle', 'Home & Lifestyle', 'bt21_official', 13),
  ('bt21_accessories', 'Accessories', 'bt21_official', 14),
  ('bt21_seasonal_limited', 'Seasonal / Limited Editions', 'bt21_official', 15),
  ('bt21_collaboration', 'Collaboration Items (Uniqlo, Converse, etc.)', 'bt21_official', 16)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, parent_slug = EXCLUDED.parent_slug, sort_order = EXCLUDED.sort_order;

COMMENT ON TABLE public.merch_categories IS 'Merch categories and subcategories; includes Official Merch, BT21 (Official), Fanmade, Collectibles, Other.';
