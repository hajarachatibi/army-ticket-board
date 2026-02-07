-- When the system auto-bans a user (3 reports or 3 scam reports), also remove all their
-- active listings so they no longer appear in browse and cannot be connected to.

-- Helper: remove all non-removed, non-sold listings for a seller (used after banning).
CREATE OR REPLACE FUNCTION public.remove_listings_for_seller(p_seller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_seller_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.listings
  SET status = 'removed',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE seller_id = p_seller_id
    AND status IN ('processing', 'active', 'locked');
END;
$$;

-- Auto-ban on 3 user reports: after banning, remove all their listings.
CREATE OR REPLACE FUNCTION public.auto_ban_user_if_reported(p_reported_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_email text;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_count
  FROM public.user_reports
  WHERE reported_user_id = p_reported_user_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_count, 0) < 3 THEN
    RETURN;
  END IF;

  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE id = p_reported_user_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN;
  END IF;

  PERFORM public.record_banned_socials_for_email(v_email, 'Auto-banned: 3 reports from different users');

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 reports from different users')
  ON CONFLICT (email) DO NOTHING;

  PERFORM public.remove_listings_for_seller(p_reported_user_id);
END;
$$;

-- Auto-ban across listings/tickets scam reports: after banning, remove all their listings.
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

  PERFORM public.record_banned_socials_for_email(v_email, 'Auto-banned: 3 scam reports across listings/tickets');

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 scam reports across listings/tickets')
  ON CONFLICT (email) DO NOTHING;

  PERFORM public.remove_listings_for_seller(p_owner_id);
END;
$$;
