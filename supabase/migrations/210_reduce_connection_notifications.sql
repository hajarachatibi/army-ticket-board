-- Reduce connection notifications: remove bonding, preview, and comfort notifications
-- (these steps are now merged; keep request_accepted, social, agreement, match_confirmed, etc.)

-- 1) Ticket connections: remove connection_bonding_submitted, connection_preview_ready, connection_comfort_updated
DROP TRIGGER IF EXISTS connections_notify_user_notifications_trigger ON public.connections;
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
  r RECORD;
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
      FOR r IN
        SELECT c.buyer_id, c.id AS conn_id
        FROM public.connections c
        WHERE c.listing_id = NEW.listing_id
          AND c.id != NEW.id
          AND c.stage = 'pending_seller'
      LOOP
        PERFORM public.notify_user(
          r.buyer_id,
          'connection_on_waiting_list',
          'The seller accepted another buyer. You are on the waiting list.',
          NULL,
          NULL,
          NEW.listing_id,
          v_summary,
          r.conn_id
        );
      END LOOP;
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

CREATE TRIGGER connections_notify_user_notifications_trigger
  AFTER INSERT OR UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.connections_notify_user_notifications();

-- 2) Merch connections: same – remove bonding_submitted, preview_ready, comfort_updated
DROP TRIGGER IF EXISTS merch_connections_notify_user_notifications_trigger ON public.merch_connections;
DROP FUNCTION IF EXISTS public.merch_connections_notify_user_notifications();
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
    ELSIF NEW.stage = 'declined' AND OLD.stage = 'pending_seller' THEN
      PERFORM public.notify_user_merch(
        NEW.buyer_id,
        'connection_request_declined',
        'Your connection request was declined.',
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

CREATE TRIGGER merch_connections_notify_user_notifications_trigger
  AFTER INSERT OR UPDATE ON public.merch_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.merch_connections_notify_user_notifications();

COMMENT ON FUNCTION public.merch_connections_notify_user_notifications() IS 'Same as ticket connections; bonding/preview/comfort notifications removed (steps merged). connection_ended only from end_merch_connection().';
