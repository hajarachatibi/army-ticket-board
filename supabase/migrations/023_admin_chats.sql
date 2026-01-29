-- Admin–user chats: two-way conversations. "Message" in admin panel opens a chat room.

CREATE TABLE IF NOT EXISTS public.admin_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_chats_admin_user ON public.admin_chats(admin_id, user_id);
CREATE INDEX IF NOT EXISTS idx_admin_chats_user ON public.admin_chats(user_id);

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_chat_id uuid NOT NULL REFERENCES public.admin_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_username text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_chat ON public.admin_chat_messages(admin_chat_id);

ALTER TABLE public.admin_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;

-- admin_chats: admin or the user can select.
DROP POLICY IF EXISTS "admin_chats_select" ON public.admin_chats;
CREATE POLICY "admin_chats_select"
  ON public.admin_chats FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR user_id = auth.uid());

-- admin_chats: only admin can insert (create conversation).
DROP POLICY IF EXISTS "admin_chats_insert" ON public.admin_chats;
CREATE POLICY "admin_chats_insert"
  ON public.admin_chats FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- admin_chat_messages: admin or the user can select.
DROP POLICY IF EXISTS "admin_chat_messages_select" ON public.admin_chat_messages;
CREATE POLICY "admin_chat_messages_select"
  ON public.admin_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_chats ac
      WHERE ac.id = admin_chat_id AND (ac.admin_id = auth.uid() OR ac.user_id = auth.uid())
    )
  );

-- admin_chat_messages: admin or the user can insert (send message).
DROP POLICY IF EXISTS "admin_chat_messages_insert" ON public.admin_chat_messages;
CREATE POLICY "admin_chat_messages_insert"
  ON public.admin_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.admin_chats ac
      WHERE ac.id = admin_chat_id AND (ac.admin_id = auth.uid() OR ac.user_id = auth.uid())
    )
  );

-- Get-or-create admin chat. Admin only. Returns { id, admin_id, user_id, created_at }.
CREATE OR REPLACE FUNCTION public.admin_get_or_create_chat(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  row record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  admin_id := auth.uid();
  IF p_user_id IS NULL OR p_user_id = admin_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  SELECT ac.id, ac.admin_id, ac.user_id, ac.created_at INTO row
  FROM public.admin_chats ac
  WHERE ac.admin_id = admin_id AND ac.user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at);
  END IF;

  INSERT INTO public.admin_chats (admin_id, user_id)
  VALUES (admin_id, p_user_id)
  RETURNING id, admin_id, user_id, created_at INTO row;

  RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_or_create_chat(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_chat_messages;
  END IF;
END $$;

COMMENT ON TABLE public.admin_chats IS 'Admin–user chat rooms; one per (admin, user) pair.';
COMMENT ON TABLE public.admin_chat_messages IS 'Messages in admin–user chats.';
