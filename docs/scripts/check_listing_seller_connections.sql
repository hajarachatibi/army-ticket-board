-- Check if a listing's seller has reached the 3-connection limit
-- Replace with the listing_id the buyer is trying to connect to

WITH listing_info AS (
  SELECT id, seller_id, status
  FROM public.listings
  WHERE id = 'LISTING_UUID_HERE'
  LIMIT 1
)
SELECT 
  'Listing ID: ' || l.id::text AS info,
  'Seller ID: ' || l.seller_id::text AS seller,
  'Listing Status: ' || l.status AS listing_status
FROM listing_info l

UNION ALL

SELECT 
  'Seller email: ' || u.email AS info,
  '' AS seller,
  '' AS listing_status
FROM listing_info l
JOIN auth.users u ON u.id = l.seller_id

UNION ALL

SELECT 
  'Seller active connections (old logic): ' || count(*)::text AS info,
  '' AS seller,
  '' AS listing_status
FROM listing_info l
JOIN public.connections c ON c.seller_id = l.seller_id
WHERE c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')

UNION ALL

SELECT 
  'Seller active connections (new logic): ' || count(*)::text AS info,
  '' AS seller,
  '' AS listing_status
FROM listing_info l
JOIN public.connections c ON c.seller_id = l.seller_id
WHERE c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
  AND (c.stage = 'chat_open' OR c.stage_expires_at IS NULL OR c.stage_expires_at >= now());

-- List all seller's active connections:
SELECT 
  c.id,
  c.stage,
  c.stage_expires_at,
  c.stage_expires_at < now() AS is_past_expiry,
  c.listing_id,
  'Connection details' AS note
FROM listing_info l
JOIN public.connections c ON c.seller_id = l.seller_id
WHERE c.stage IN ('bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
ORDER BY c.created_at DESC;
