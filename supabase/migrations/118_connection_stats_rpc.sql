-- RPC for connection stats: active count, waiting list count, and count by stage.
-- Active = not ended/expired/declined. Waiting list = pending_seller.

CREATE OR REPLACE FUNCTION public.get_connection_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active bigint;
  v_waiting_list bigint;
  v_by_stage jsonb;
BEGIN
  SELECT count(*) INTO v_active
  FROM public.connections
  WHERE stage NOT IN ('ended', 'expired', 'declined');

  SELECT count(*) INTO v_waiting_list
  FROM public.connections
  WHERE stage = 'pending_seller';

  SELECT coalesce(jsonb_object_agg(stage, cnt), '{}'::jsonb) INTO v_by_stage
  FROM (
    SELECT stage, count(*)::bigint AS cnt
    FROM public.connections
    GROUP BY stage
    ORDER BY stage
  ) s;

  RETURN jsonb_build_object(
    'active_connections', coalesce(v_active, 0),
    'waiting_list_count', coalesce(v_waiting_list, 0),
    'by_stage', coalesce(v_by_stage, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO service_role;

COMMENT ON FUNCTION public.get_connection_stats() IS 'Returns active connection count, waiting list (pending_seller) count, and counts by stage.';
