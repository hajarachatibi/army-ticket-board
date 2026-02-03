-- Admin channel replies: admins see full email, users see masked username (e***-7a8f).
-- RPC returns display_label so email is never sent to non-admin clients.

CREATE OR REPLACE FUNCTION public.mask_username_for_channel(p_username text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
  -- First letter + '***-' + last 4 chars of user id (e.g. e***-7a8f).
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
      WHEN public.is_admin() THEN coalesce(nullif(trim(up.email), ''), up.username, 'User')
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
COMMENT ON FUNCTION public.get_admin_channel_replies(uuid) IS 'Replies for admin channel post: admins get full email as display_label, others get masked username.';
