-- Auto-end inactive chats after 24 hours and unlock the listing.

DROP FUNCTION IF EXISTS public.process_inactive_connection_chats();
CREATE OR REPLACE FUNCTION public.process_inactive_connection_chats()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  WITH stale AS (
    SELECT c.connection_id, c.listing_id, c.id AS chat_id
    FROM public.chats c
    WHERE c.connection_id IS NOT NULL
      AND c.status = 'open'
      AND c.last_message_at < now() - interval '24 hours'
  ),
  closed AS (
    UPDATE public.chats c
    SET status = 'closed',
        closed_at = now()
    WHERE c.id IN (SELECT chat_id FROM stale)
    RETURNING c.id
  )
  UPDATE public.connections cn
  SET stage = 'ended',
      stage_expires_at = now()
  WHERE cn.id IN (SELECT connection_id FROM stale)
    AND cn.stage = 'chat_open';

  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE l.id IN (SELECT listing_id FROM stale)
    AND l.status = 'locked';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_inactive_connection_chats() TO authenticated;

