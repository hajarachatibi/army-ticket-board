-- Admin: paginated user lists with created_at, last_login_at; send-to-all messaging.

-- Sellers (paginated).
CREATE OR REPLACE FUNCTION public.admin_list_sellers_paged(p_limit int, p_offset int)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT count(*) INTO total
  FROM public.user_profiles up
  WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.owner_id = up.id);
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.username, up.email, up.created_at, up.last_login_at
    FROM public.user_profiles up
    WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.owner_id = up.id)
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- Buyers (paginated).
CREATE OR REPLACE FUNCTION public.admin_list_buyers_paged(p_limit int, p_offset int)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  WITH buyers AS (
    SELECT DISTINCT up.id
    FROM public.user_profiles up
    WHERE EXISTS (SELECT 1 FROM public.requests r WHERE r.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM public.chats c WHERE c.buyer_id = up.id)
  )
  SELECT count(*) INTO total FROM buyers;
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.username, up.email, up.created_at, up.last_login_at
    FROM public.user_profiles up
    WHERE EXISTS (SELECT 1 FROM public.requests r WHERE r.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM public.chats c WHERE c.buyer_id = up.id)
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- All users (paginated).
CREATE OR REPLACE FUNCTION public.admin_list_all_users_paged(p_limit int, p_offset int)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT count(*) INTO total FROM public.user_profiles;
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.username, up.email, up.created_at, up.last_login_at
    FROM public.user_profiles up
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- Send same message to all sellers (no pagination needed).
CREATE OR REPLACE FUNCTION public.admin_send_message_to_all_sellers(p_message text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  r record;
  n bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  admin_id := auth.uid();
  FOR r IN
    SELECT up.id
    FROM public.user_profiles up
    WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.owner_id = up.id)
  LOOP
    INSERT INTO public.admin_messages (sender_id, recipient_id, message)
    VALUES (admin_id, r.id, p_message);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Send same message to all buyers.
CREATE OR REPLACE FUNCTION public.admin_send_message_to_all_buyers(p_message text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  r record;
  n bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  admin_id := auth.uid();
  FOR r IN
    SELECT DISTINCT up.id
    FROM public.user_profiles up
    WHERE EXISTS (SELECT 1 FROM public.requests r2 WHERE r2.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM public.chats c WHERE c.buyer_id = up.id)
  LOOP
    INSERT INTO public.admin_messages (sender_id, recipient_id, message)
    VALUES (admin_id, r.id, p_message);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Send same message to all users.
CREATE OR REPLACE FUNCTION public.admin_send_message_to_all_users(p_message text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  r record;
  n bigint := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  admin_id := auth.uid();
  FOR r IN SELECT id FROM public.user_profiles
  LOOP
    INSERT INTO public.admin_messages (sender_id, recipient_id, message)
    VALUES (admin_id, r.id, p_message);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_sellers_paged(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_buyers_paged(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_users_paged(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_message_to_all_sellers(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_message_to_all_buyers(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_message_to_all_users(text) TO authenticated;
