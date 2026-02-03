-- Store 2-letter country code from request geo (Vercel x-vercel-ip-country) on each login.
-- Lets admins see where users were connecting from (e.g. to confirm scammer region).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_login_country text;

COMMENT ON COLUMN public.user_profiles.last_login_country IS '2-letter ISO country code from last OAuth login (set in auth callback from Vercel geo header).';

-- Include in admin user list RPCs (sellers, buyers, all users).
CREATE OR REPLACE FUNCTION public.admin_list_sellers_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total FROM user_profiles up
  WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)
    AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at, up.last_login_country
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_buyers_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  WITH buyers AS (
    SELECT DISTINCT up.id
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM connections c WHERE c.buyer_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
  )
  SELECT count(*) INTO total FROM buyers;
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at, up.last_login_country
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM connections c WHERE c.buyer_id = up.id)
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_all_users_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total FROM user_profiles up
  WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%';
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at, up.last_login_country
    FROM user_profiles up
    WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%'
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;
