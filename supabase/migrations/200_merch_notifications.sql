-- Merch connection notifications: same flow as ticket connections (in-app + push).
-- 1) user_notifications: add merch columns
-- 2) notify_user_merch() for merch connection events
-- 3) Trigger on merch_connections mirroring connections_notify_user_notifications
-- 4) end_merch_connection notifies the other party

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS merch_connection_id uuid REFERENCES public.merch_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merch_listing_id uuid REFERENCES public.merch_listings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_notifications.merch_connection_id IS 'Set for merch connection notifications; link to /merch/connections/[id]';
COMMENT ON COLUMN public.user_notifications.merch_listing_id IS 'Merch listing context when type is a connection_* and merch_connection_id is set';

-- Notify for merch: same types as ticket connections, stored with merch_connection_id and merch_listing_id
CREATE OR REPLACE FUNCTION public.notify_user_merch(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_merch_listing_id uuid DEFAULT NULL,
  p_listing_summary text DEFAULT NULL,
  p_merch_connection_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg text := NULLIF(trim(coalesce(p_message, '')), '');
BEGIN
  INSERT INTO public.user_notifications (
    user_id,
    type,
    message,
    listing_summary,
    merch_listing_id,
    merch_connection_id
  )
  VALUES (
    p_user_id,
    p_type,
    v_msg,
    p_listing_summary,
    p_merch_listing_id,
    p_merch_connection_id
  );
END;
$$;

-- Trigger function: mirror connections_notify_user_notifications for merch_connections
CREATE OR REPLACE FUNCTION public.merch_connections_notify_user_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary text;
  r RECORD;
BEGIN
  SELECT COALESCE(NULLIF(trim(ml.title), ''), 'Merch listing')
  INTO v_summary
  FROM public.merch_listings ml
  WHERE ml.id = COALESCE(NEW.merch_listing_id, OLD.merch_listing_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.stage = 'pending_seller' THEN
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_request_received',
        'New connection request received.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF (NEW.stage = 'bonding' AND OLD.stage = 'pending_seller')
       OR (NEW.stage = 'buyer_bonding_v2' AND OLD.stage = 'pending_seller') THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_request_accepted',
        'Your connection request was accepted. Please answer the bonding questions.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_request_accepted',
        'You accepted this connection request. Waiting for bonding answers.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      FOR r IN
        SELECT c.buyer_id, c.id AS conn_id
        FROM public.merch_connections c
        WHERE c.merch_listing_id = NEW.merch_listing_id
          AND c.id != NEW.id
          AND c.stage = 'pending_seller'
      LOOP
        PERFORM public.notify_user_merch(
          r.buyer_id,
          'connection_on_waiting_list',
          'The seller accepted another buyer. You are on the waiting list.',
          NEW.merch_listing_id,
          v_summary,
          r.conn_id
        );
      END LOOP;
    ELSIF NEW.stage = 'bonding' AND OLD.stage = 'buyer_bonding_v2' THEN
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_bonding_submitted',
        'Buyer submitted bonding answers. Please submit yours.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'declined' AND OLD.stage = 'pending_seller' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_request_declined',
        'Your connection request was declined.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'preview' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_preview_ready',
        'Preview is ready. Review each other''s info and answer the comfort question.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_preview_ready',
        'Preview is ready. Review each other''s info and answer the comfort question.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'social' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_social_updated',
        'Next step: decide whether to share your socials. Socials are shared only if both choose Yes.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_social_updated',
        'Next step: decide whether to share your socials. Socials are shared only if both choose Yes.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'agreement' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_agreement_updated',
        'You have a match message to confirm.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_agreement_updated',
        'You have a match message to confirm.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'chat_open' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_match_confirmed',
        'Match confirmed. If both opted to share socials, you can connect there now.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_match_confirmed',
        'Match confirmed. If both opted to share socials, you can connect there now.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'ended' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_ended',
        'This connection has ended.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_ended',
        'This connection has ended.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    ELSIF NEW.stage = 'expired' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_expired',
        'This connection expired due to inactivity.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user_merch(
        NEW.seller_id,
        'connection_expired',
        'This connection expired due to inactivity.',
        NEW.merch_listing_id,
        v_summary,
        NEW.id
      );
    END IF;
  END IF;

  IF NEW.buyer_bonding_submitted_at IS DISTINCT FROM OLD.buyer_bonding_submitted_at
     AND NEW.buyer_bonding_submitted_at IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.seller_id,
      'connection_bonding_submitted',
      'Buyer submitted bonding answers. Please submit yours.',
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_bonding_submitted_at IS DISTINCT FROM OLD.seller_bonding_submitted_at
     AND NEW.seller_bonding_submitted_at IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.buyer_id,
      'connection_bonding_submitted',
      'Seller submitted bonding answers. Please submit yours.',
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_comfort IS DISTINCT FROM OLD.buyer_comfort
     AND NEW.buyer_comfort IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.seller_id,
      'connection_comfort_updated',
      CASE
        WHEN NEW.buyer_comfort = true THEN 'Buyer answered: Yes, comfortable. Waiting for your answer.'
        ELSE 'Buyer answered: No (not comfortable). Connection will end.'
      END,
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_comfort IS DISTINCT FROM OLD.seller_comfort
     AND NEW.seller_comfort IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.buyer_id,
      'connection_comfort_updated',
      CASE
        WHEN NEW.seller_comfort = true THEN 'Seller answered: Yes, comfortable. Waiting for your answer.'
        ELSE 'Seller answered: No (not comfortable). Connection will end.'
      END,
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_social_share IS DISTINCT FROM OLD.buyer_social_share
     AND NEW.buyer_social_share IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.seller_id,
      'connection_social_updated',
      CASE
        WHEN NEW.buyer_social_share = true THEN 'Buyer chose: Yes, share socials. Waiting for your choice.'
        ELSE 'Buyer chose: No, do not share socials. Waiting for your choice.'
      END,
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_social_share IS DISTINCT FROM OLD.seller_social_share
     AND NEW.seller_social_share IS NOT NULL THEN
    PERFORM public.notify_user_merch(
      NEW.buyer_id,
      'connection_social_updated',
      CASE
        WHEN NEW.seller_social_share = true THEN 'Seller chose: Yes, share socials. Waiting for your choice.'
        ELSE 'Seller chose: No, do not share socials. Waiting for your choice.'
      END,
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.buyer_agreed IS DISTINCT FROM OLD.buyer_agreed AND NEW.buyer_agreed = true THEN
    PERFORM public.notify_user_merch(
      NEW.seller_id,
      'connection_agreement_updated',
      'Buyer confirmed the match message. Please confirm too.',
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  IF NEW.seller_agreed IS DISTINCT FROM OLD.seller_agreed AND NEW.seller_agreed = true THEN
    PERFORM public.notify_user_merch(
      NEW.buyer_id,
      'connection_agreement_updated',
      'Seller confirmed the match message. Please confirm too.',
      NEW.merch_listing_id,
      v_summary,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS merch_connections_notify_user_notifications_trigger ON public.merch_connections;
CREATE TRIGGER merch_connections_notify_user_notifications_trigger
  AFTER INSERT OR UPDATE ON public.merch_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.merch_connections_notify_user_notifications();

-- end_merch_connection: notify the other party with custom message (same as end_connection)
CREATE OR REPLACE FUNCTION public.end_merch_connection(p_connection_id uuid, p_ended_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.merch_connections%ROWTYPE;
  v_summary text;
  v_notify_user_id uuid;
  v_message text;
BEGIN
  SELECT * INTO v FROM public.merch_connections WHERE id = p_connection_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Connection not found'; END IF;
  IF NOT (v.buyer_id = auth.uid() OR v.seller_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT COALESCE(NULLIF(trim(ml.title), ''), 'Merch listing')
  INTO v_summary
  FROM public.merch_listings ml
  WHERE ml.id = v.merch_listing_id;

  UPDATE public.merch_connections
  SET stage = 'ended', stage_expires_at = now(),
      ended_by = auth.uid(), ended_at = now(), stage_before_ended = v.stage
  WHERE id = p_connection_id
    AND stage IN ('pending_seller','bonding','buyer_bonding_v2','preview','comfort','social','agreement','chat_open');

  PERFORM public.recompute_merch_listing_lock(v.merch_listing_id);

  v_notify_user_id := CASE WHEN auth.uid() = v.seller_id THEN v.buyer_id ELSE v.seller_id END;
  v_message := COALESCE(
    NULLIF(trim(p_ended_reason), ''),
    CASE
      WHEN auth.uid() = v.seller_id THEN 'The seller ended the connection.'
      ELSE 'The buyer ended the connection.'
    END
  );

  PERFORM public.notify_user_merch(
    v_notify_user_id,
    'connection_ended',
    v_message,
    v.merch_listing_id,
    v_summary,
    p_connection_id
  );
END;
$$;
