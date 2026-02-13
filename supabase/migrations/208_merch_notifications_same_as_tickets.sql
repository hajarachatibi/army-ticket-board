-- Merch notifications: same as ticket listings.
-- For tickets, connection_ended is sent only by end_connection() (one notification to the other party).
-- Remove connection_ended from the merch trigger so only end_merch_connection() sends it (same behavior).

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

COMMENT ON FUNCTION public.merch_connections_notify_user_notifications() IS 'Same as ticket connections: connection_ended is sent only by end_merch_connection(), not by this trigger.';
