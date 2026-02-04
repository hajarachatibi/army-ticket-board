-- When an admin removes a listing, allow an optional message to the seller; create a notification.

-- 1) Add notification type for admin-removed listing
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
      'connection_expired',
      'listing_removed_3_reports',
      'listing_removed_by_admin',
      'story_published',
      'story_admin_replied'
    )
  );

-- 2) admin_remove_listing: optional message to seller → insert user_notification
DROP FUNCTION IF EXISTS public.admin_remove_listing(uuid);
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

  -- Get seller and summary before we change the listing (for notification)
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
    AND stage IN ('pending_seller','bonding','preview','social','agreement','chat_open');

  UPDATE public.listings
  SET status = 'removed', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
  WHERE id = p_listing_id;

  -- Notify seller with admin message if provided
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
GRANT EXECUTE ON FUNCTION public.admin_remove_listing(uuid, text) TO authenticated;
