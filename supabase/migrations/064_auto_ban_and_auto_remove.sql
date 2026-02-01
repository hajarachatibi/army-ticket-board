-- Automatic enforcement:
-- - Auto-ban a user if they receive 3 reports from 3 different users.
-- - Auto-remove a listing if it receives 3 reports from 3 different users.
-- - (Compat) Auto-remove a legacy ticket if it receives 3 reports from 3 different users.

-- =============================================================================
-- 1) Listing reports
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reported_by_username text,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_reports_listing_id ON public.listing_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_reporter_id ON public.listing_reports(reporter_id);

ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can view their own; seller can view their listing reports; admins can view all.
DROP POLICY IF EXISTS "listing_reports_select" ON public.listing_reports;
CREATE POLICY "listing_reports_select"
  ON public.listing_reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid())
    OR public.is_admin()
  );

-- Any signed-in user can report a listing.
DROP POLICY IF EXISTS "listing_reports_insert" ON public.listing_reports;
CREATE POLICY "listing_reports_insert"
  ON public.listing_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- =============================================================================
-- 2) Auto-ban user on 3 distinct reporters
-- =============================================================================
DROP FUNCTION IF EXISTS public.auto_ban_user_if_reported(uuid);
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

  INSERT INTO public.banned_users (email, reason)
  VALUES (v_email, 'Auto-banned: 3 reports from different users')
  ON CONFLICT (email) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.user_reports_auto_ban_trigger();
CREATE OR REPLACE FUNCTION public.user_reports_auto_ban_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_ban_user_if_reported(NEW.reported_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_reports_auto_ban ON public.user_reports;
CREATE TRIGGER user_reports_auto_ban
  AFTER INSERT ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.user_reports_auto_ban_trigger();

-- =============================================================================
-- 3) Auto-remove listing on 3 distinct reporters
-- =============================================================================
DROP FUNCTION IF EXISTS public.auto_remove_listing_if_reported(uuid);
CREATE OR REPLACE FUNCTION public.auto_remove_listing_if_reported(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_count
  FROM public.listing_reports
  WHERE listing_id = p_listing_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_count, 0) < 3 THEN
    RETURN;
  END IF;

  UPDATE public.listings
  SET status = 'removed',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL
  WHERE id = p_listing_id;
END;
$$;

DROP FUNCTION IF EXISTS public.listing_reports_auto_remove_trigger();
CREATE OR REPLACE FUNCTION public.listing_reports_auto_remove_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_remove_listing_if_reported(NEW.listing_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_reports_auto_remove ON public.listing_reports;
CREATE TRIGGER listing_reports_auto_remove
  AFTER INSERT ON public.listing_reports
  FOR EACH ROW EXECUTE FUNCTION public.listing_reports_auto_remove_trigger();

-- =============================================================================
-- 4) Compat: auto-remove legacy ticket on 3 distinct reporters
-- =============================================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

DROP FUNCTION IF EXISTS public.auto_remove_ticket_if_reported(uuid);
CREATE OR REPLACE FUNCTION public.auto_remove_ticket_if_reported(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_count
  FROM public.reports
  WHERE ticket_id = p_ticket_id
    AND reporter_id IS NOT NULL;

  IF COALESCE(v_count, 0) < 3 THEN
    RETURN;
  END IF;

  UPDATE public.tickets
  SET listing_status = 'rejected',
      removed_at = now()
  WHERE id = p_ticket_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reports_auto_remove_ticket_trigger();
CREATE OR REPLACE FUNCTION public.reports_auto_remove_ticket_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.auto_remove_ticket_if_reported(NEW.ticket_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_auto_remove_ticket ON public.reports;
CREATE TRIGGER reports_auto_remove_ticket
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_auto_remove_ticket_trigger();

