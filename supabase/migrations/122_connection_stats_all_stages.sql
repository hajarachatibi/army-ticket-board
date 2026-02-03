-- Connection stats: always return all stages in funnel order, with 0 for stages that have no connections.
-- This matches the connections_stage_check: pending_seller, declined, bonding, preview, comfort, social, agreement, chat_open, ended, expired.

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
  v_stages text[] := ARRAY[
    'pending_seller', 'declined', 'bonding', 'preview', 'comfort',
    'social', 'agreement', 'chat_open', 'ended', 'expired'
  ];
  v_stage text;
  v_counts jsonb := '{}'::jsonb;
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_active
  FROM public.connections
  WHERE stage NOT IN ('ended', 'expired', 'declined');

  SELECT count(*) INTO v_waiting_list
  FROM public.connections
  WHERE stage = 'pending_seller';

  -- Build by_stage with all stages in order; use 0 for stages with no rows.
  FOREACH v_stage IN ARRAY v_stages
  LOOP
    SELECT count(*) INTO v_cnt FROM public.connections WHERE stage = v_stage;
    v_counts := v_counts || jsonb_build_object(v_stage, coalesce(v_cnt, 0)::bigint);
  END LOOP;

  RETURN jsonb_build_object(
    'active_connections', coalesce(v_active, 0),
    'waiting_list_count', coalesce(v_waiting_list, 0),
    'by_stage', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO service_role;

COMMENT ON FUNCTION public.get_connection_stats() IS 'Returns active connection count, waiting list (pending_seller) count, and counts for all stages (funnel order, 0 where none).';
