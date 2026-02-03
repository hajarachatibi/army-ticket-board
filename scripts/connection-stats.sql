-- Connection stats: run in Supabase Dashboard → SQL Editor
-- Definitions:
--   Active connections = stage NOT IN ('ended', 'expired', 'declined')
--   Waiting list = stage = 'pending_seller' (buyers waiting for seller to accept)

-- 1) Summary
SELECT
  (SELECT count(*) FROM public.connections WHERE stage NOT IN ('ended', 'expired', 'declined')) AS active_connections,
  (SELECT count(*) FROM public.connections WHERE stage = 'pending_seller') AS waiting_list_count;

-- 2) Count by stage
SELECT stage, count(*) AS count
FROM public.connections
GROUP BY stage
ORDER BY count DESC, stage;
