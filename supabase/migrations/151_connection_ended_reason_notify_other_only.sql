-- Connection ended: notify only the party who didn't end it, with a reason they can see when they click.

-- 1) Trigger: stop notifying both sides when stage = 'ended'. Notifications are sent by end_connection RPC or by admin_remove_listing.
DROP FUNCTION IF EXISTS public.connections_notify_user_notifications();
CREATE OR REPLACE FUNCTION public.connections_notify_user_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text;
  v_day text;
  v_summary text;
BEGIN
  SELECT l.concert_city, l.concert_date::text
  INTO v_city, v_day
  FROM public.listings l
  WHERE l.id = COALESCE(NEW.listing_id, OLD.listing_id);

  v_summary := COALESCE(v_city, 'Listing') || ' · ' || COALESCE(v_day, '—');

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'pending_seller' THEN
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_request_received',
        'New connection request received.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Stage transitions (notify both sides for key steps). No notification here for 'ended' — end_connection or admin_remove_listing sends one to the other party only.
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage = 'bonding' AND OLD.stage = 'pending_seller' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_request_accepted',
        'Your connection request was accepted. Please answer the bonding questions.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_request_accepted',
        'You accepted this connection request. Waiting for bonding answers.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'declined' AND OLD.stage = 'pending_seller' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_request_declined',
        'Your connection request was declined.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'preview' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_preview_ready',
        'Preview is ready. Review each other''s info and answer the comfort question.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_preview_ready',
        'Preview is ready. Review each other''s info and answer the comfort question.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'social' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_social_updated',
        'Next step: decide whether to share your socials. Socials are shared only if both choose Yes.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_social_updated',
        'Next step: decide whether to share your socials. Socials are shared only if both choose Yes.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'agreement' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_agreement_updated',
        'You have a match message to confirm.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_agreement_updated',
        'You have a match message to confirm.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'chat_open' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_match_confirmed',
        'Match confirmed. If both opted to share socials, you can connect there now.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_match_confirmed',
        'Match confirmed. If both opted to share socials, you can connect there now.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'expired' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_expired',
        'This connection expired due to inactivity.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_expired',
        'This connection expired due to inactivity.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
    END IF;
  END IF;

  -- 4b) Per-user actions (notify the other side).
  IF NEW.buyer_bonding_submitted_at IS DISTINCT FROM OLD.buyer_bonding_submitted_at
     AND NEW.buyer_bonding_submitted_at IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.seller_id,
      'connection_bonding_submitted',
      'Buyer submitted bonding answers. Please submit yours.',
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_bonding_submitted_at IS DISTINCT FROM OLD.seller_bonding_submitted_at
     AND NEW.seller_bonding_submitted_at IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.buyer_id,
      'connection_bonding_submitted',
      'Seller submitted bonding answers. Please submit yours.',
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_comfort IS DISTINCT FROM OLD.buyer_comfort
     AND NEW.buyer_comfort IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.seller_id,
      'connection_comfort_updated',
      CASE
        WHEN NEW.buyer_comfort = true THEN 'Buyer answered: Yes, comfortable. Waiting for your answer.'
        ELSE 'Buyer answered: No (not comfortable). Connection will end.'
      END,
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_comfort IS DISTINCT FROM OLD.seller_comfort
     AND NEW.seller_comfort IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.buyer_id,
      'connection_comfort_updated',
      CASE
        WHEN NEW.seller_comfort = true THEN 'Seller answered: Yes, comfortable. Waiting for your answer.'
        ELSE 'Seller answered: No (not comfortable). Connection will end.'
      END,
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_social_share IS DISTINCT FROM OLD.buyer_social_share
     AND NEW.buyer_social_share IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.seller_id,
      'connection_social_updated',
      CASE
        WHEN NEW.buyer_social_share = true THEN 'Buyer chose: Yes, share socials. Waiting for your choice.'
        ELSE 'Buyer chose: No, do not share socials. Waiting for your choice.'
      END,
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_social_share IS DISTINCT FROM OLD.seller_social_share
     AND NEW.seller_social_share IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.buyer_id,
      'connection_social_updated',
      CASE
        WHEN NEW.seller_social_share = true THEN 'Seller chose: Yes, share socials. Waiting for your choice.'
        ELSE 'Seller chose: No, do not share socials. Waiting for your choice.'
      END,
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_agreed IS DISTINCT FROM OLD.buyer_agreed AND NEW.buyer_agreed = true THEN
    PERFORM public.notify_user(
      NEW.seller_id,
      'connection_agreement_updated',
      'Buyer confirmed the match message. Please confirm too.',
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_agreed IS DISTINCT FROM OLD.seller_agreed AND NEW.seller_agreed = true THEN
    PERFORM public.notify_user(
      NEW.buyer_id,
      'connection_agreement_updated',
      'Seller confirmed the match message. Please confirm too.',
      NULL,
      NULL,
      NEW.listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2) end_connection: notify only the other party (the one who didn't end it), with optional reason.
DROP FUNCTION IF EXISTS public.end_connection(uuid);
DROP FUNCTION IF EXISTS public.end_connection(uuid, text);
CREATE OR REPLACE FUNCTION public.end_connection(p_connection_id uuid, p_ended_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_message text;
BEGIN
  SELECT * INTO v
  FROM public.connections
  WHERE id = p_connection_id
  FOR UPDATE;

  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
  INTO v_summary
  FROM public.listings l
  WHERE l.id = v.listing_id;
  v_summary := COALESCE(NULLIF(trim(v_summary), ''), 'Listing');

  UPDATE public.connections
  SET stage = 'ended',
      stage_expires_at = now()
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

  UPDATE public.listings l
  SET status = 'active',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE l.id = v.listing_id
    AND l.status = 'locked'
    AND l.locked_by = v.buyer_id;

  -- Notify only the other party (the one who didn't end the connection).
  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  v_message := COALESCE(NULLIF(trim(p_ended_reason), ''),
    CASE WHEN auth.uid() = v.seller_id THEN 'The seller ended the connection.' ELSE 'The buyer ended the connection.' END
  );
  PERFORM public.notify_user(
    v_notify_user_id,
    'connection_ended',
    v_message,
    NULL,
    NULL,
    v.listing_id,
    v_summary,
    p_connection_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_connection(uuid, text) TO authenticated;

-- 3) admin_remove_listing: after ending connections, notify each buyer with reason.
CREATE OR REPLACE FUNCTION public.admin_remove_listing(p_listing_id uuid, p_admin_message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_seller_id uuid;
  v_summary text;
  v_message_trim text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT l.seller_id,
         trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
  INTO v_seller_id, v_summary
  FROM public.listings l
  WHERE l.id = p_listing_id;

  SELECT c.chat_id INTO v_chat_id
  FROM public.connections c
  WHERE c.listing_id = p_listing_id
  LIMIT 1;

  IF v_chat_id IS NOT NULL THEN
    UPDATE public.chats SET status = 'closed', closed_at = now() WHERE id = v_chat_id;
  END IF;

  UPDATE public.connections
  SET stage = 'ended', stage_expires_at = now()
  WHERE listing_id = p_listing_id
    AND stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

  -- Notify each buyer (they didn't end it; listing was removed by admin).
  INSERT INTO public.user_notifications (user_id, type, message, listing_id, listing_summary, connection_id)
  SELECT c.buyer_id,
         'connection_ended',
         'The listing was removed by the admins.',
         c.listing_id,
         NULLIF(trim(coalesce(v_summary, '')), ''),
         c.id
  FROM public.connections c
  WHERE c.listing_id = p_listing_id;

  UPDATE public.listings
  SET status = 'removed', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE id = p_listing_id;

  v_message_trim := trim(coalesce(p_admin_message, ''));
  IF v_seller_id IS NOT NULL AND v_message_trim <> '' THEN
    INSERT INTO public.user_notifications (user_id, type, message, listing_id, listing_summary)
    VALUES (
      v_seller_id,
      'listing_removed_by_admin',
      v_message_trim,
      p_listing_id,
      NULLIF(v_summary, '')
    );
  END IF;
END;
$$;
