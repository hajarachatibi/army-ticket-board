-- Admin channel replies: admin repliers show full email to everyone; non-admin repliers show full email to admin viewers, masked username (e***-7a8f) to others.

-- SQL language: body is a single SELECT that returns the value (no semicolon/block issues).
CREATE OR REPLACE FUNCTION public.mask_username_for_channel(p_username text, p_user_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(left(nullif(trim(p_username), ''), 1), '*') || '***-' || right(p_user_id::text, 4);
$$;

CREATE OR REPLACE FUNCTION public.get_admin_channel_replies(p_post_id uuid)
RETURNS TABLE (
  id uuid,
  post_id uuid,
  user_id uuid,
  text text,
  created_at timestamptz,
  display_label text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.post_id,
    r.user_id,
    r.text,
    r.created_at,
    CASE
      WHEN (coalesce(up.role, '') = 'admin') OR public.is_admin() THEN coalesce(nullif(trim(up.email), ''), up.username, 'User')
      ELSE public.mask_username_for_channel(up.username, up.id)
    END AS display_label,
    coalesce(up.role, 'user')::text AS role
  FROM public.admin_channel_replies r
  JOIN public.user_profiles up ON up.id = r.user_id
  WHERE r.post_id = p_post_id
  ORDER BY r.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_channel_replies(uuid) TO authenticated;

COMMENT ON FUNCTION public.mask_username_for_channel(text, uuid) IS 'Mask username for non-admin display: first letter + ***- + last 4 of user id (e.g. e***-7a8f).';
COMMENT ON FUNCTION public.get_admin_channel_replies(uuid) IS 'Replies for admin channel post: admin repliers show full email to everyone; non-admin repliers show full email to admin viewers, masked username to others.';
