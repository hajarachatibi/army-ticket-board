-- Diagnostic: "Limit 3 connections reached" when user says they have no open connections
-- Run in Supabase SQL Editor (or with service role). Replace the email with the user's email.

-- 1) Resolve user id from email (auth.users is only visible with appropriate privileges)
-- If you use a different way to get user id (e.g. from user_profiles by display name), adjust.
DO $$
DECLARE
  v_user_id uuid;
  r record;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nadine.schmitt90@web.de' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found for this email. Check auth.users or user_profiles.';
    RETURN;
  END IF;

  RAISE NOTICE 'User id: %', v_user_id;

  -- 2) List all connections where user is buyer or seller, with stage and expiry
  FOR r IN
    SELECT c.id, c.stage, c.stage_expires_at, c.listing_id,
           l.status AS listing_status,
           (c.stage_expires_at IS NOT NULL AND c.stage_expires_at < now()) AS is_past_expiry
    FROM public.connections c
    LEFT JOIN public.listings l ON l.id = c.listing_id
    WHERE c.buyer_id = v_user_id OR c.seller_id = v_user_id
    ORDER BY c.created_at DESC
  LOOP
    RAISE NOTICE 'id=% stage=% stage_expires_at=% listing_status=% is_past_expiry=%',
      r.id, r.stage, r.stage_expires_at, r.listing_status, r.is_past_expiry;
  END LOOP;
END;
$$;

-- Simpler: just list connections for a known user id (replace with actual uuid)
-- SELECT c.id, c.stage, c.stage_expires_at,
--        (c.stage_expires_at IS NOT NULL AND c.stage_expires_at < now()) AS past_expiry,
--        l.status AS listing_status
-- FROM public.connections c
-- LEFT JOIN public.listings l ON l.id = c.listing_id
-- WHERE c.buyer_id = 'USER_UUID_HERE' OR c.seller_id = 'USER_UUID_HERE'
-- ORDER BY c.created_at DESC;
