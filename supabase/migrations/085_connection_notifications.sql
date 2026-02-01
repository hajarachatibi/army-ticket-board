-- Connection + stage notifications (server-backed).
-- Extends public.user_notifications so users get realtime notifications for connection events.

-- 1) Extend table schema to support listings/connections.
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS listing_summary text,
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.connections(id) ON DELETE CASCADE;

-- 2) Expand allowed notification types (keep legacy ticket_*).
ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (
    type IN (
      'ticket_approved',
      'ticket_rejected',
      'connection_request_received',
      'connection_request_accepted',
      'connection_request_declined',
      'connection_bonding_submitted',
      'connection_preview_ready',
      'connection_comfort_updated',
      'connection_social_updated',
      'connection_agreement_updated',
      'connection_match_confirmed',
      'connection_ended',
      'connection_expired'
    )
  );

-- 3) Helper to insert notifications (runs as owner; bypasses RLS safely).
DROP FUNCTION IF EXISTS public.notify_user(uuid, text, text, uuid, text, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_ticket_id uuid DEFAULT NULL,
  p_ticket_summary text DEFAULT NULL,
  p_listing_id uuid DEFAULT NULL,
  p_listing_summary text DEFAULT NULL,
  p_connection_id uuid DEFAULT NULL
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
    ticket_id,
    ticket_summary,
    message,
    listing_id,
    listing_summary,
    connection_id
  )
  VALUES (
    p_user_id,
    p_type,
    p_ticket_id,
    p_ticket_summary,
    v_msg,
    p_listing_id,
    p_listing_summary,
    p_connection_id
  );
END;
$$;

-- 4) Trigger: create notifications based on connection events.
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

  -- 4a) Stage transitions (notify both sides for key steps).
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
        'Preview is ready. Review each other’s info and answer the comfort question.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_preview_ready',
        'Preview is ready. Review each other’s info and answer the comfort question.',
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
    ELSIF NEW.stage = 'ended' THEN
      PERFORM public.notify_user(
        NEW.buyer_id,
        'connection_ended',
        'This connection has ended.',
        NULL,
        NULL,
        NEW.listing_id,
        v_summary,
        NEW.id
      );
      PERFORM public.notify_user(
        NEW.seller_id,
        'connection_ended',
        'This connection has ended.',
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

DROP TRIGGER IF EXISTS connections_notify_user_notifications_trigger ON public.connections;
CREATE TRIGGER connections_notify_user_notifications_trigger
  AFTER INSERT OR UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.connections_notify_user_notifications();

