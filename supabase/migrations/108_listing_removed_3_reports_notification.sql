-- When a listing gets 3 reports and is auto-removed, notify the owner and store report reasons.
-- Owner can click the notification to see the main reasons (no full details).

-- 1) Add column for report reasons (main reason labels only).
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS report_reasons text;

COMMENT ON COLUMN public.user_notifications.report_reasons IS 'Comma-separated main reasons when type = listing_removed_3_reports.';

-- 2) Allow new notification type.
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
      'listing_removed_3_reports'
    )
  );

-- 3) Notify owner when listing is removed due to 3 reports (call from auto_enforce_listing_reports).
CREATE OR REPLACE FUNCTION public.notify_listing_removed_3_reports(
  p_owner_id uuid,
  p_listing_id uuid,
  p_listing_summary text,
  p_report_reasons text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_notifications (
    user_id,
    type,
    message,
    listing_id,
    listing_summary,
    report_reasons
  )
  VALUES (
    p_owner_id,
    'listing_removed_3_reports',
    'Your listing was removed after 3 reports.',
    p_listing_id,
    NULLIF(trim(coalesce(p_listing_summary, '')), ''),
    NULLIF(trim(coalesce(p_report_reasons, '')), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_listing_removed_3_reports(uuid, uuid, text, text) TO authenticated;

-- 4) In auto_enforce_listing_reports: when we remove the listing, notify owner with main reasons.
CREATE OR REPLACE FUNCTION public.auto_enforce_listing_reports(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_any_count int;
  v_scam_count int;
  v_owner_id uuid;
  v_summary text;
  v_reasons text;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_any_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_any_count, 0) >= 3 THEN
    -- Get owner and summary before updating (for notification).
    SELECT l.seller_id,
           trim(concat_ws(' · ', NULLIF(trim(l.concert_city), ''), NULLIF(trim(l.concert_date::text), '')))
      INTO v_owner_id, v_summary
      FROM public.listings l
      WHERE l.id = p_listing_id;

    -- Distinct main reasons (unique reason labels only).
    SELECT string_agg(reason, ', ' ORDER BY reason)
      INTO v_reasons
      FROM (SELECT DISTINCT reason FROM public.listing_reports
            WHERE listing_id = p_listing_id
              AND reason IS NOT NULL AND trim(reason) <> '') s(reason);

    UPDATE public.listings
    SET status = 'removed',
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = p_listing_id;

    IF v_owner_id IS NOT NULL THEN
      PERFORM public.notify_listing_removed_3_reports(
        v_owner_id,
        p_listing_id,
        COALESCE(v_summary, 'Listing'),
        COALESCE(v_reasons, 'Reported')
      );
    END IF;
  END IF;

  SELECT seller_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  -- Ban owner if scam reports reach threshold across all their listings/tickets.
  PERFORM public.auto_ban_owner_if_scam_reports(v_owner_id);

  -- (Also keep single-listing scam threshold as fast path.)
  SELECT count(DISTINCT reporter_id) INTO v_scam_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL
    AND public.is_scam_reason(reason) = true;

  IF COALESCE(v_scam_count, 0) < 3 THEN
    RETURN;
  END IF;

  PERFORM public.auto_ban_owner_if_scam_reports(v_owner_id);
END;
$$;
