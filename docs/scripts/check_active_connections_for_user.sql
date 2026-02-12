-- Check what connections are actually counting toward the 3-connection limit
-- Replace 'user@example.com' with the affected user's email

WITH user_info AS (
  SELECT id FROM auth.users WHERE email = 'nadine.schmitt90@web.de' LIMIT 1
)
SELECT 
  c.id,
  c.stage,
  c.stage_expires_at,
  c.stage_expires_at < now() AS is_past_expiry,
  CASE 
    WHEN c.stage = 'chat_open' THEN true
    WHEN c.stage_expires_at IS NULL THEN true
    WHEN c.stage_expires_at >= now() THEN true
    ELSE false
  END AS would_count_after_migration_195,
  CASE
    WHEN c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open') THEN true
    ELSE false
  END AS counts_now_old_logic,
  l.status AS listing_status
FROM public.connections c
CROSS JOIN user_info
LEFT JOIN public.listings l ON l.id = c.listing_id
WHERE c.buyer_id = user_info.id OR c.seller_id = user_info.id
ORDER BY c.created_at DESC;

-- Count how many are actively blocking them:
WITH user_info AS (
  SELECT id FROM auth.users WHERE email = 'nadine.schmitt90@web.de' LIMIT 1
)
SELECT 
  'As BUYER - old logic (before migration 195) - limit was 3' AS label,
  count(*) AS count
FROM public.connections c
CROSS JOIN user_info
WHERE c.buyer_id = user_info.id
  AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')

UNION ALL

SELECT 
  'As BUYER - new logic (migration 195+) - limit is 5' AS label,
  count(*) AS count
FROM public.connections c
CROSS JOIN user_info
WHERE c.buyer_id = user_info.id
  AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
  AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now())

UNION ALL

SELECT 
  'As SELLER - old logic (before migration 195)' AS label,
  count(*) AS count
FROM public.connections c
CROSS JOIN user_info
WHERE c.seller_id = user_info.id
  AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')

UNION ALL

SELECT 
  'As SELLER - new logic (after migration 195)' AS label,
  count(*) AS count
FROM public.connections c
CROSS JOIN user_info
WHERE c.seller_id = user_info.id
  AND c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
  AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());
