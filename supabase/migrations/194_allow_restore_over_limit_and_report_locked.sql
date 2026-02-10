-- 1) Allow restoring an ended connection even when the user is already at the 3-connection limit.
--    The buyer trigger enforce_max_active_connections_per_buyer blocks UPDATEs that would exceed 3;
--    when we're restoring (OLD.stage = 'ended' -> NEW.stage active), skip the limit check.
-- 2) No seller-side trigger on connections; seller limit is only in seller_respond_connection (accept path).

DROP TRIGGER IF EXISTS connections_enforce_max_active_buyer ON public.connections;
CREATE OR REPLACE FUNCTION public.enforce_max_active_connections_per_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int; v_buyer uuid;
BEGIN
  v_buyer := COALESCE(NEW.buyer_id, OLD.buyer_id);
  IF v_buyer IS NULL THEN RETURN NEW; END IF;

  -- Restore: going from 'ended' back to an active stage. Allow regardless of current count.
  IF TG_OP = 'UPDATE' AND OLD.stage = 'ended' AND NEW.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_buyer::text));
  SELECT count(*) INTO v_count FROM public.connections c
  WHERE c.buyer_id = v_buyer AND c.stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open')
    AND (TG_OP <> 'UPDATE' OR c.id <> NEW.id);
  IF COALESCE(v_count, 0) >= 3 THEN
    RAISE EXCEPTION 'You have reached the maximum of 3 active connection requests. Please complete or end one before connecting to another listing.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER connections_enforce_max_active_buyer
  BEFORE INSERT OR UPDATE OF stage, buyer_id ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_active_connections_per_buyer();

COMMENT ON FUNCTION public.enforce_max_active_connections_per_buyer() IS
'Limit buyer to 3 active connections. Restoring an ended connection (UPDATE from ended to active stage) is always allowed.';
