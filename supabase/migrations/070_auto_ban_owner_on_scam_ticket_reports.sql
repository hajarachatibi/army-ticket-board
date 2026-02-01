-- Auto enforcement refinement:
-- - If a listing/ticket gets 3 reports from 3 different users (any reason) -> remove it.
-- - If it gets 3 reports from 3 different users with reason "scam" -> ban the owner.

-- Helper: decide whether a reason counts as "scam".
DROP FUNCTION IF EXISTS public.is_scam_reason(text);
CREATE OR REPLACE FUNCTION public.is_scam_reason(p_reason text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN p_reason IS NULL THEN false
      ELSE (
        lower(trim(p_reason)) = 'scam'
        OR lower(trim(p_reason)) = 'scammer'
        OR lower(trim(p_reason)) = 'fraud'
        OR lower(trim(p_reason)) = 'fraudulent'
        OR lower(trim(p_reason)) LIKE '%scam%'
      )
    END;
$$;

-- =============================================================================
-- Listings: remove on 3 reports; ban owner on 3 scam reports.
-- =============================================================================
DROP FUNCTION IF EXISTS public.auto_enforce_listing_reports(uuid);
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
  v_email text;
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

  SELECT count(DISTINCT reporter_id) INTO v_scam_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL
    AND public.is_scam_reason(reason) = true;

  IF COALESCE(v_scam_count, 0) < 3 THEN
    RETURN;
  END IF;

  SELECT seller_id INTO v_owner_id
  FROM public.listings
  WHERE id = p_listing_id;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE id = v_owner_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 scam reports on a listing')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.listing_reports_auto_enforce_trigger();
CREATE OR REPLACE FUNCTION public.listing_reports_auto_enforce_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_enforce_listing_reports(NEW.listing_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_reports_auto_remove ON public.listing_reports;
DROP TRIGGER IF EXISTS listing_reports_auto_enforce ON public.listing_reports;
CREATE TRIGGER listing_reports_auto_enforce
  AFTER INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.listing_reports_auto_enforce_trigger();

-- =============================================================================
-- Legacy tickets (public.reports): remove on 3 reports; ban owner on 3 scam reports.
-- =============================================================================
DROP FUNCTION IF EXISTS public.auto_enforce_ticket_reports(uuid);
CREATE OR REPLACE FUNCTION public.auto_enforce_ticket_reports(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_any_count int;
  v_scam_count int;
  v_owner_id uuid;
  v_email text;
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

  SELECT count(DISTINCT reporter_id) INTO v_scam_count
  FROM public.reports
  WHERE ticket_id = p_ticket_id
    AND reporter_id IS NOT NULL
    AND public.is_scam_reason(reason) = true;

  IF COALESCE(v_scam_count, 0) < 3 THEN
    RETURN;
  END IF;

  SELECT owner_id INTO v_owner_id
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE id = v_owner_id;

  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 scam reports on a ticket')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.reports_auto_enforce_ticket_trigger();
CREATE OR REPLACE FUNCTION public.reports_auto_enforce_ticket_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_enforce_ticket_reports(NEW.ticket_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_auto_remove_ticket ON public.reports;
DROP TRIGGER IF EXISTS reports_auto_enforce_ticket ON public.reports;
CREATE TRIGGER reports_auto_enforce_ticket
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_auto_enforce_ticket_trigger();

