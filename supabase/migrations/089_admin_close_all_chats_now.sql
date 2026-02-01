-- Admin: close/stop all open chats (legacy chats + admin chats).

DROP FUNCTION IF EXISTS public.admin_close_all_chats_now();
CREATE OR REPLACE FUNCTION public.admin_close_all_chats_now()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chats_closed int := 0;
  v_admin_chats_closed int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Close legacy chats (including any connection-backed ones if present).
  IF to_regclass('public.chats') IS NOT NULL THEN
    UPDATE public.chats
    SET status = 'closed',
        closed_at = now()
    WHERE status = 'open';
    GET DIAGNOSTICS v_chats_closed = ROW_COUNT;
  END IF;

  -- Stop admin chats (admin_chats has open/closed status).
  IF to_regclass('public.admin_chats') IS NOT NULL THEN
    UPDATE public.admin_chats
    SET status = 'closed',
        closed_at = now()
    WHERE status = 'open';
    GET DIAGNOSTICS v_admin_chats_closed = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'chats_closed', v_chats_closed,
    'admin_chats_closed', v_admin_chats_closed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_close_all_chats_now() TO authenticated;

