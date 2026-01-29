-- Admin: delete report, unban user, dashboard stats, inactive users, reports reporter/owner ids.
-- User lists: add last_login_at, created_at. user_profiles: show_admin_badge for achatibihajar.

-- 1. Delete report (admin only).
CREATE OR REPLACE FUNCTION public.admin_delete_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.reports WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_report(uuid) TO authenticated;

-- 2. Unban user (admin only).
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_email IS NULL OR trim(p_email) = '' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  DELETE FROM public.banned_users WHERE email = trim(p_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(text) TO authenticated;

-- 3. Dashboard stats.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN (
    SELECT json_build_object(
      'users', (SELECT count(*)::int FROM user_profiles),
      'tickets', (SELECT count(*)::int FROM tickets),
      'reports', (SELECT count(*)::int FROM reports),
      'banned', (SELECT count(*)::int FROM banned_users),
      'sellers', (SELECT count(*)::int FROM user_profiles up WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.owner_id = up.id)),
      'buyers', (SELECT count(*)::int FROM (
        SELECT 1 FROM user_profiles up
        WHERE EXISTS (SELECT 1 FROM requests r WHERE r.requester_id = up.id)
           OR EXISTS (SELECT 1 FROM chats c WHERE c.buyer_id = up.id)
      ) x)
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- 4. Inactive users: last_login_at older than p_days or null. Default 30 days.
CREATE OR REPLACE FUNCTION public.admin_list_inactive_users_paged(
  p_limit int,
  p_offset int,
  p_days int DEFAULT 30
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
  cutoff timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  cutoff := now() - (greatest(0, coalesce(p_days, 30)) || ' days')::interval;
  SELECT count(*) INTO total
  FROM user_profiles up
  WHERE up.last_login_at IS NULL OR up.last_login_at < cutoff;
  SELECT json_agg(t) INTO rows
  FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
    FROM user_profiles up
    WHERE up.last_login_at IS NULL OR up.last_login_at < cutoff
    ORDER BY up.last_login_at NULLS FIRST, up.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_inactive_users_paged(int, int, int) TO authenticated;

-- 5. Reports with reporter_id, owner_id, reporter_email, owner_email for "open chat".
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
      rep.reporter_id,
      up_reporter.email AS reporter_email,
      rep.reported_by_username,
      rep.reason,
      rep.details,
      rep.created_at,
      t.owner_id AS owner_id,
      up_owner.email AS owner_email,
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
      t.status AS ticket_status
    FROM reports rep
    JOIN tickets t ON t.id = rep.ticket_id
    LEFT JOIN user_profiles up_owner ON up_owner.id = t.owner_id
    LEFT JOIN user_profiles up_reporter ON up_reporter.id = rep.reporter_id
    WHERE EXISTS (SELECT 1 FROM user_profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
    ORDER BY rep.created_at DESC
  ) r;
$$;

-- 6. user_profiles: show_admin_badge (for achatibihajar only).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS show_admin_badge boolean NOT NULL DEFAULT false;
UPDATE public.user_profiles SET show_admin_badge = true WHERE email = 'achatibihajar@gmail.com';

-- 7. User list RPCs: add created_at, last_login_at.
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
  WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.owner_id = up.id)
    AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%');
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
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
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  WITH buyers AS (
    SELECT DISTINCT up.id FROM user_profiles up
    WHERE (EXISTS (SELECT 1 FROM requests r WHERE r.requester_id = up.id)
       OR EXISTS (SELECT 1 FROM chats c WHERE c.buyer_id = up.id))
      AND (search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%')
  )
  SELECT count(*) INTO total FROM buyers;
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
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
DECLARE total bigint; rows json; search_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  search_trim := trim(coalesce(p_search, ''));
  SELECT count(*) INTO total FROM user_profiles up
  WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%';
  SELECT json_agg(t) INTO rows FROM (
    SELECT up.id, up.email, up.created_at, up.last_login_at
    FROM user_profiles up
    WHERE search_trim = '' OR up.username ILIKE '%' || search_trim || '%' OR up.email ILIKE '%' || search_trim || '%'
    ORDER BY up.username
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) t;
  RETURN json_build_object('data', COALESCE(rows, '[]'::json), 'total', total);
END;
$$;
