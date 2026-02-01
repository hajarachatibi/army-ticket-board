-- Auto-ban seller across multiple listings/tickets:
-- If a seller receives 3 scam reports from 3 different users (across any listings/tickets),
-- ban the owner (even if reports are spread across different tickets).

DROP FUNCTION IF EXISTS public.auto_ban_owner_if_scam_reports(uuid);
CREATE OR REPLACE FUNCTION public.auto_ban_owner_if_scam_reports(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_email text;
BEGIN
  IF p_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Count DISTINCT reporters across:
  -- - listing_reports for listings where seller_id = owner
  -- - ticket reports (public.reports) for tickets where owner_id = owner
  WITH scam_reporters AS (
    SELECT DISTINCT lr.reporter_id
    FROM public.listing_reports lr
    JOIN public.listings l ON l.id = lr.listing_id
    WHERE l.seller_id = p_owner_id
      AND lr.reporter_id IS NOT NULL
      AND public.is_scam_reason(lr.reason) = true
    UNION
    SELECT DISTINCT r.reporter_id
    FROM public.reports r
    JOIN public.tickets t ON t.id = r.ticket_id
    WHERE t.owner_id = p_owner_id
      AND r.reporter_id IS NOT NULL
      AND public.is_scam_reason(r.reason) = true
  )
  SELECT count(*) INTO v_count FROM scam_reporters;

  IF COALESCE(v_count, 0) < 3 THEN
    RETURN;
  END IF;

  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE id = p_owner_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 scam reports across listings/tickets')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

-- Update enforcement functions to also apply cross-ticket scam ban logic on every report insert.

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
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_any_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_any_count, 0) >= 3 THEN
    UPDATE public.listings
    SET status = 'removed',
        locked_by = NULL,
        locked_at = NULL,
        lock_expires_at = NULL
    WHERE id = p_listing_id;
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

CREATE OR REPLACE FUNCTION public.auto_enforce_ticket_reports(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_any_count int;
  v_owner_id uuid;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_any_count
  FROM public.reports
  WHERE ticket_id = p_ticket_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_any_count, 0) >= 3 THEN
    UPDATE public.tickets
    SET listing_status = 'rejected',
        removed_at = now()
    WHERE id = p_ticket_id;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.tickets
  WHERE id = p_ticket_id;

  -- Ban owner if scam reports reach threshold across all their listings/tickets.
  PERFORM public.auto_ban_owner_if_scam_reports(v_owner_id);
END;
$$;

