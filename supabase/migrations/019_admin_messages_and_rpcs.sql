-- Admin messages (admin -> user). Admins send; users read their own.

CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient ON public.admin_messages(recipient_id);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_messages_select_own" ON public.admin_messages;
CREATE POLICY "admin_messages_select_own"
  ON public.admin_messages FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "admin_messages_insert_admin" ON public.admin_messages;
CREATE POLICY "admin_messages_insert_admin"
  ON public.admin_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Helper: true if current user is admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Admin: ban user and delete their data.
CREATE OR REPLACE FUNCTION public.admin_ban_and_delete_user(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  INSERT INTO public.banned_users (email, reason)
  VALUES (p_email, 'Banned by admin')
  ON CONFLICT (email) DO NOTHING;
  DELETE FROM public.tickets
  WHERE owner_id IN (SELECT id FROM public.user_profiles WHERE email = p_email);
  DELETE FROM public.user_profiles WHERE email = p_email;
END;
$$;

-- Admin: delete a ticket.
CREATE OR REPLACE FUNCTION public.admin_delete_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  DELETE FROM public.tickets WHERE id = p_ticket_id;
END;
$$;

-- Admin: list sellers (users who own at least one ticket).
CREATE OR REPLACE FUNCTION public.admin_list_sellers()
RETURNS TABLE(id uuid, username text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT up.id, up.username, up.email
  FROM public.user_profiles up
  WHERE EXISTS (SELECT 1 FROM public.tickets t WHERE t.owner_id = up.id)
  ORDER BY up.username;
END;
$$;

-- Admin: list buyers (users who have requested or been buyer in a chat).
CREATE OR REPLACE FUNCTION public.admin_list_buyers()
RETURNS TABLE(id uuid, username text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT DISTINCT up.id, up.username, up.email
  FROM public.user_profiles up
  WHERE EXISTS (SELECT 1 FROM public.requests r WHERE r.requester_id = up.id)
     OR EXISTS (SELECT 1 FROM public.chats c WHERE c.buyer_id = up.id)
  ORDER BY up.username;
END;
$$;

-- Admin: list all users (for "message all").
CREATE OR REPLACE FUNCTION public.admin_list_all_users()
RETURNS TABLE(id uuid, username text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT up.id, up.username, up.email
  FROM public.user_profiles up
  ORDER BY up.username;
END;
$$;

-- Admin: send same message to multiple users.
CREATE OR REPLACE FUNCTION public.admin_send_message(p_recipient_ids uuid[], p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  admin_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  admin_id := auth.uid();
  FOREACH uid IN ARRAY p_recipient_ids
  LOOP
    INSERT INTO public.admin_messages (sender_id, recipient_id, message)
    VALUES (admin_id, uid, p_message);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ban_and_delete_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sellers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_buyers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_message(uuid[], text) TO authenticated;
