-- Let admins see full emails in lite profiles (for moderation/safety).
-- Regular users still only see full email for admin targets.

CREATE OR REPLACE FUNCTION public.get_lite_profile(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid;
  v_allowed boolean;
  v_viewer_is_admin boolean;
  v_target_is_admin boolean;
  v_username text;
  v_email text;
  v_approved_count int;
  v_answers json;
BEGIN
  v_viewer := auth.uid();
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_viewer_is_admin := public.is_admin();

  v_allowed :=
    (v_viewer = p_user_id)
    OR v_viewer_is_admin
    OR EXISTS (
      SELECT 1 FROM public.chats c
      WHERE (c.buyer_id = v_viewer AND c.seller_id = p_user_id)
         OR (c.seller_id = v_viewer AND c.buyer_id = p_user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_chats ac
      WHERE (ac.admin_id = v_viewer AND ac.user_id = p_user_id)
         OR (ac.user_id = v_viewer AND ac.admin_id = p_user_id)
    );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT up.username, up.email, (up.role = 'admin') INTO v_username, v_email, v_target_is_admin
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  v_approved_count := (
    SELECT count(*)::int
    FROM public.tickets t
    WHERE t.owner_id = p_user_id AND t.listing_status = 'approved'
  );

  SELECT COALESCE(json_agg(x ORDER BY x.position, x.created_at), '[]'::json) INTO v_answers
  FROM (
    SELECT
      q.id,
      q.prompt,
      q.kind,
      q.position,
      COALESCE(
        (SELECT fs.answers ->> q.id::text
         FROM public.forum_submissions fs
         WHERE fs.user_id = p_user_id
         ORDER BY fs.submitted_at DESC
         LIMIT 1),
        ''
      ) AS answer,
      q.created_at
    FROM public.forum_questions q
    WHERE q.active = true
  ) x;

  RETURN json_build_object(
    'id', p_user_id,
    'username', COALESCE(v_username, 'User'),
    'is_admin', COALESCE(v_target_is_admin, false),
    'email',
      CASE
        WHEN v_viewer_is_admin OR v_target_is_admin THEN COALESCE(v_email, '')
        ELSE ''
      END,
    'seller_approved_count', COALESCE(v_approved_count, 0),
    'forum_answers', v_answers
  );
END;
$$;

