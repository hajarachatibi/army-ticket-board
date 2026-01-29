-- List admin chats for current user (as admin or as user) with other party email and last message.
-- Used on Chats page to show these as normal chats (no "Admin" label). Works for both admin and user.

CREATE OR REPLACE FUNCTION public.get_my_admin_chats()
RETURNS TABLE (
  id uuid,
  other_email text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_text text,
  last_sender_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ac.id,
    CASE
      WHEN ac.admin_id = auth.uid() THEN up_user.email
      ELSE up_admin.email
    END AS other_email,
    ac.created_at,
    last_msg.at AS last_message_at,
    last_msg.txt AS last_text,
    last_msg.sender_username AS last_sender_username
  FROM public.admin_chats ac
  LEFT JOIN public.user_profiles up_user ON up_user.id = ac.user_id
  LEFT JOIN public.user_profiles up_admin ON up_admin.id = ac.admin_id
  LEFT JOIN LATERAL (
    SELECT m.created_at AS at, m.text AS txt, m.sender_username AS sender_username
    FROM public.admin_chat_messages m
    WHERE m.admin_chat_id = ac.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) last_msg ON true
  WHERE ac.admin_id = auth.uid() OR ac.user_id = auth.uid()
  ORDER BY last_msg.at DESC NULLS LAST, ac.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO anon;

COMMENT ON FUNCTION public.get_my_admin_chats() IS 'Admin chats for current user; other_email and last message. Shown as normal chats on /chats.';
