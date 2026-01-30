-- Extend get_my_admin_chats to include other_user_id (used for user reporting in admin chats).
-- Also keep admin badge automatic for role='admin'.

DROP FUNCTION IF EXISTS public.get_my_admin_chats();
CREATE OR REPLACE FUNCTION public.get_my_admin_chats()
RETURNS TABLE (
  id uuid,
  other_user_id uuid,
  other_email text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_text text,
  last_sender_username text,
  last_sender_id uuid,
  status text,
  closed_at timestamptz,
  is_admin boolean,
  other_show_admin_badge boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ac.id,
    CASE WHEN ac.admin_id = auth.uid() THEN ac.user_id ELSE ac.admin_id END AS other_user_id,
    CASE WHEN ac.admin_id = auth.uid() THEN up_user.email ELSE up_admin.email END AS other_email,
    ac.created_at,
    last_msg.at AS last_message_at,
    last_msg.txt AS last_text,
    last_msg.sender_username AS last_sender_username,
    last_msg.sender_id AS last_sender_id,
    ac.status,
    ac.closed_at,
    (ac.admin_id = auth.uid()) AS is_admin,
    (CASE
      WHEN ac.admin_id = auth.uid() THEN (up_user.role = 'admin')
      ELSE (up_admin.role = 'admin')
    END) AS other_show_admin_badge
  FROM public.admin_chats ac
  LEFT JOIN public.user_profiles up_user ON up_user.id = ac.user_id
  LEFT JOIN public.user_profiles up_admin ON up_admin.id = ac.admin_id
  LEFT JOIN LATERAL (
    SELECT m.created_at AS at, m.text AS txt, m.sender_username AS sender_username, m.sender_id AS sender_id
    FROM public.admin_chat_messages m WHERE m.admin_chat_id = ac.id
    ORDER BY m.created_at DESC LIMIT 1
  ) last_msg ON true
  WHERE ac.admin_id = auth.uid() OR ac.user_id = auth.uid()
  ORDER BY last_msg.at DESC NULLS LAST, ac.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO anon;

