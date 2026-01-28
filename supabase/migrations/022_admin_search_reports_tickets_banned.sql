-- Admin: reports with ticket details + owner email; tickets with owner email + search; banned list; user search.

-- Reports with full ticket details and owner email.
CREATE OR REPLACE FUNCTION public.admin_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      rep.id,
      rep.ticket_id,
      rep.reported_by_username,
      rep.reason,
      rep.details,
      rep.created_at,
      t.event AS ticket_event,
      t.city AS ticket_city,
      t.day AS ticket_day,
      t.section AS ticket_section,
      t.seat_row AS ticket_row,
      t.seat AS ticket_seat,
      t.type AS ticket_type,
      t.quantity AS ticket_quantity,
      t.price AS ticket_price,
      t.currency AS ticket_currency,
      t.status AS ticket_status,
      up.email AS owner_email
    FROM reports rep
    JOIN tickets t ON t.id = rep.ticket_id
    LEFT JOIN user_profiles up ON up.id = t.owner_id
    WHERE EXISTS (SELECT 1 FROM user_profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
    ORDER BY rep.created_at DESC
  ) r;
$$;

-- Paginated tickets with owner email; optional search by owner email.
CREATE OR REPLACE FUNCTION public.admin_tickets_paged(
  p_limit int,
  p_offset int,
  p_search text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
  search_trim text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total
  FROM tickets t
  LEFT JOIN user_profiles up ON up.id = t.owner_id
  WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(x) INTO rows
  FROM (
    SELECT
      t.id,
      t.event,
      t.city,
      t.day,
      t.vip,
      t.quantity,
      t.section,
      t.seat_row,
      t.seat,
      t.type,
      t.status,
      t.owner_id,
      t.price,
      t.currency,
      t.created_at,
      up.email AS owner_email
    FROM tickets t
    LEFT JOIN user_profiles up ON up.id = t.owner_id
    WHERE (search_trim = '' OR up.email ILIKE '%' || search_trim || '%')
    ORDER BY t.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- Banned users list.
CREATE OR REPLACE FUNCTION public.admin_list_banned()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(b ORDER BY b.banned_at DESC), '[]'::json)
  FROM (
    SELECT email, banned_at, reason
    FROM banned_users
    WHERE EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  ) b;
$$;

-- User lists: add search by name (username) or email; return only id, email (drop display name, last login).
CREATE OR REPLACE FUNCTION public.admin_list_sellers_paged(p_limit int, p_offset int, p_search text DEFAULT '')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total bigint;
  rows json;
  search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total
  FROM user_profiles up
  WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.owner_id = up.id)
    AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.email
    FROM user_profiles up
    WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.owner_id = up.id)
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
DECLARE
  total bigint;
  rows json;
  search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  WITH buyers AS (
    SELECT DISTINCT up.id
    FROM user_profiles up
    WHERE (EXISTS (SELECT 1 FROM requests r WHERE r.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM chats c WHERE c.buyer_id = up.id))
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
  )
  SELECT count(*) INTO total FROM buyers;
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.email
    FROM user_profiles up
    WHERE (EXISTS (SELECT 1 FROM requests r WHERE r.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM chats c WHERE c.buyer_id = up.id))
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
DECLARE
  total bigint;
  rows json;
  search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total
  FROM user_profiles up
  WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%';
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.email
    FROM user_profiles up
    WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%'
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;

-- Update grants for modified signatures (sellers/buyers/all add p_search).
GRANT EXECUTE ON FUNCTION public.admin_reports_with_details() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tickets_paged(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_banned() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sellers_paged(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_buyers_paged(int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_users_paged(int, int, text) TO authenticated;
