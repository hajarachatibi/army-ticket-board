-- One-off: remove all listings that have no seats (soft delete: status = 'removed'),
-- end any connections, and notify each seller.

DO $$
DECLARE
  v_listing_id uuid;
  v_seller_id uuid;
  v_summary text;
  v_chat_id uuid;
BEGIN
  FOR v_listing_id, v_seller_id, v_summary IN
    SELECT l.id,
           l.seller_id,
           trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
    FROM public.listings l
    WHERE l.status <> 'removed'
      AND NOT EXISTS (SELECT 1 FROM public.listing_seats s WHERE s.listing_id = l.id)
  LOOP
    -- End any connections for this listing
    SELECT c.chat_id INTO v_chat_id
    FROM public.connections c
    WHERE c.listing_id = v_listing_id
    LIMIT 1;

    IF v_chat_id IS NOT NULL THEN
      UPDATE public.chats SET status = 'closed', closed_at = now() WHERE id = v_chat_id;
    END IF;

    UPDATE public.connections
    SET stage = 'ended', stage_expires_at = now()
    WHERE listing_id = v_listing_id
      AND stage IN ('pending_seller','bonding','preview','comfort','social','agreement','chat_open');

    -- Notify buyers (connection_ended)
    INSERT INTO public.user_notifications (user_id, type, message, listing_id, listing_summary, connection_id)
    SELECT c.buyer_id,
           'connection_ended',
           'The listing was removed because it had no seats.',
           c.listing_id,
           NULLIF(trim(coalesce(v_summary, '')), ''),
           c.id
    FROM public.connections c
    WHERE c.listing_id = v_listing_id;

    -- Notify seller
    IF v_seller_id IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, type, message, listing_id, listing_summary)
      VALUES (
        v_seller_id,
        'listing_removed_by_admin',
        'This listing has been removed because it has no seats.',
        v_listing_id,
        NULLIF(v_summary, '')
      );
    END IF;

    -- Soft-delete the listing
    UPDATE public.listings
    SET status = 'removed', locked_by = NULL, locked_at = NULL, lock_expires_at = NULL
    WHERE id = v_listing_id;
  END LOOP;
END;
$$;
