-- Fix 400 Bad Request: use text param and cast to uuid inside.
-- Some PostgREST setups reject uuid params from JSON; text works reliably.

DROP FUNCTION IF EXISTS public.admin_get_or_create_chat(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_or_create_chat(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_admin_id uuid;
  row record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  v_admin_id := auth.uid();

  IF p_user_id IS NULL OR trim(p_user_id) = '' THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  BEGIN
    v_uid := p_user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid user id';
  END;
  IF v_uid = v_admin_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  SELECT ac.id, ac.admin_id, ac.user_id, ac.created_at INTO row
  FROM public.admin_chats ac
  WHERE ac.admin_id = v_admin_id AND ac.user_id = v_uid
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at);
  END IF;

  INSERT INTO public.admin_chats (admin_id, user_id)
  VALUES (v_admin_id, v_uid)
  RETURNING id, admin_id, user_id, created_at INTO row;

  RETURN json_build_object('id', row.id, 'admin_id', row.admin_id, 'user_id', row.user_id, 'created_at', row.created_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_or_create_chat(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_or_create_chat(text) TO anon;

COMMENT ON FUNCTION public.admin_get_or_create_chat(text) IS 'Get-or-create admin–user chat. p_user_id: UUID string.';
