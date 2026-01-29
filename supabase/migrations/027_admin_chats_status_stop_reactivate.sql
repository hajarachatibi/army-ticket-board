-- Admin chats: add status (open/closed) and closed_at. Admins can stop/reactivate.

ALTER TABLE public.admin_chats
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed'));
ALTER TABLE public.admin_chats
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

DROP POLICY IF EXISTS "admin_chats_update" ON public.admin_chats;
CREATE POLICY "admin_chats_update"
  ON public.admin_chats FOR UPDATE TO authenticated
  USING (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (admin_id = auth.uid());

COMMENT ON COLUMN public.admin_chats.status IS 'open | closed. Admin can stop/reactivate.';

-- Update get_my_admin_chats to return status, closed_at, is_admin, other_show_admin_badge.
DROP FUNCTION IF EXISTS public.get_my_admin_chats();
CREATE OR REPLACE FUNCTION public.get_my_admin_chats()
RETURNS TABLE (
  id uuid,
  other_email text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_text text,
  last_sender_username text,
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
    CASE WHEN ac.admin_id = auth.uid() THEN up_user.email ELSE up_admin.email END AS other_email,
    ac.created_at,
    last_msg.at AS last_message_at,
    last_msg.txt AS last_text,
    last_msg.sender_username AS last_sender_username,
    ac.status,
    ac.closed_at,
    (ac.admin_id = auth.uid()) AS is_admin,
    (CASE WHEN ac.admin_id = auth.uid() THEN up_user.show_admin_badge ELSE up_admin.show_admin_badge END) AS other_show_admin_badge
  FROM public.admin_chats ac
  LEFT JOIN public.user_profiles up_user ON up_user.id = ac.user_id
  LEFT JOIN public.user_profiles up_admin ON up_admin.id = ac.admin_id
  LEFT JOIN LATERAL (
    SELECT m.created_at AS at, m.text AS txt, m.sender_username AS sender_username
    FROM public.admin_chat_messages m WHERE m.admin_chat_id = ac.id
    ORDER BY m.created_at DESC LIMIT 1
  ) last_msg ON true
  WHERE ac.admin_id = auth.uid() OR ac.user_id = auth.uid()
  ORDER BY last_msg.at DESC NULLS LAST, ac.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_chats() TO anon;

-- Update admin_get_or_create_chat to return status, closed_at.
CREATE OR REPLACE FUNCTION public.admin_get_or_create_chat(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid; v_admin_id uuid; row record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  v_admin_id := auth.uid();
  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN RAISE EXCEPTION 'Invalid user'; END IF;
  BEGIN v_uid := p_user_id::uuid; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid user id'; END;
  IF v_uid = v_admin_id THEN RAISE EXCEPTION 'Invalid user'; END IF;

  SELECT ac.id, ac.admin_id, ac.user_id, ac.created_at, ac.status, ac.closed_at INTO row
  FROM public.admin_chats ac
  WHERE ac.admin_id = v_admin_id AND ac.user_id = v_uid LIMIT 1;

  IF FOUND THEN
    IF row.status = 'closed' THEN
      UPDATE public.admin_chats SET status = 'open', closed_at = NULL WHERE id = row.id;
      row.status := 'open';
      row.closed_at := NULL;
    END IF;
    RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at, 'status', row.status, 'closed_at', row.closed_at);
  END IF;

  INSERT INTO public.admin_chats (admin_id, user_id)
  VALUES (v_admin_id, v_uid)
  RETURNING id, admin_id, user_id, created_at, status, closed_at INTO row;
  RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at, 'status', row.status, 'closed_at', row.closed_at);
END;
$$;
