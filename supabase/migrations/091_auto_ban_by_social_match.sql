-- Auto-ban evasion prevention:
-- If a banned user comes back with a different Google account but reuses at least one social handle,
-- ban the new account as well.
--
-- Strategy:
-- 1) Persist normalized social handles for banned users in `banned_social_accounts`.
-- 2) When a user updates socials (onboarding/settings), if any social matches a banned social, insert them into `banned_users`.
-- 3) Snapshot socials when banning a user (admin + auto-ban) so future evasion can be detected.

-- =============================================================================
-- 1) Table: banned_social_accounts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.banned_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'snapchat')),
  value text NOT NULL,
  source_email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, value)
);

COMMENT ON TABLE public.banned_social_accounts IS 'Normalized social handles/ids for banned users, used to prevent ban evasion.';

ALTER TABLE public.banned_social_accounts ENABLE ROW LEVEL SECURITY;

-- Admin-only access (not required for enforcement; trigger runs as owner).
DROP POLICY IF EXISTS "banned_social_accounts_select_admin" ON public.banned_social_accounts;
CREATE POLICY "banned_social_accounts_select_admin"
  ON public.banned_social_accounts FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "banned_social_accounts_insert_admin" ON public.banned_social_accounts;
CREATE POLICY "banned_social_accounts_insert_admin"
  ON public.banned_social_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "banned_social_accounts_delete_admin" ON public.banned_social_accounts;
CREATE POLICY "banned_social_accounts_delete_admin"
  ON public.banned_social_accounts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- 2) Helpers: normalize socials + snapshot socials at ban time
-- =============================================================================
DROP FUNCTION IF EXISTS public.normalize_social_handle(text, text);
CREATE OR REPLACE FUNCTION public.normalize_social_handle(p_platform text, p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  v := lower(trim(coalesce(p_value, '')));
  IF v = '' THEN
    RETURN NULL;
  END IF;

  -- Strip protocol / www and drop query/fragment.
  v := regexp_replace(v, '^https?://', '', 'i');
  v := regexp_replace(v, '^www\.', '', 'i');
  v := split_part(v, '?', 1);
  v := split_part(v, '#', 1);
  v := trim(v);

  -- Normalize per platform.
  IF p_platform = 'instagram' THEN
    v := regexp_replace(v, '^instagram\.com/', '', 'i');
    v := regexp_replace(v, '^@', '');
    v := split_part(v, '/', 1);
  ELSIF p_platform = 'tiktok' THEN
    v := regexp_replace(v, '^tiktok\.com/', '', 'i');
    v := regexp_replace(v, '^@', '');
    v := split_part(v, '/', 1);
    v := regexp_replace(v, '^@', '');
  ELSIF p_platform = 'facebook' THEN
    v := regexp_replace(v, '^m\.facebook\.com/', '', 'i');
    v := regexp_replace(v, '^facebook\.com/', '', 'i');
    v := split_part(v, '/', 1);
  ELSIF p_platform = 'snapchat' THEN
    v := regexp_replace(v, '^snapchat\.com/add/', '', 'i');
    v := regexp_replace(v, '^snapchat\.com/', '', 'i');
    v := regexp_replace(v, '^@', '');
    v := split_part(v, '/', 1);
  ELSE
    -- Unknown platform: do best-effort.
    v := regexp_replace(v, '^@', '');
    v := split_part(v, '/', 1);
  END IF;

  v := trim(v);
  IF v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

DROP FUNCTION IF EXISTS public.record_banned_socials_for_email(text, text);
CREATE OR REPLACE FUNCTION public.record_banned_socials_for_email(p_email text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instagram text;
  v_facebook text;
  v_tiktok text;
  v_snapchat text;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN;
  END IF;

  SELECT instagram, facebook, tiktok, snapchat
  INTO v_instagram, v_facebook, v_tiktok, v_snapchat
  FROM public.user_profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_instagram IS NOT NULL THEN
    INSERT INTO public.banned_social_accounts (platform, value, source_email, reason)
    VALUES ('instagram', public.normalize_social_handle('instagram', v_instagram), p_email, p_reason)
    ON CONFLICT (platform, value) DO NOTHING;
  END IF;

  IF v_facebook IS NOT NULL THEN
    INSERT INTO public.banned_social_accounts (platform, value, source_email, reason)
    VALUES ('facebook', public.normalize_social_handle('facebook', v_facebook), p_email, p_reason)
    ON CONFLICT (platform, value) DO NOTHING;
  END IF;

  IF v_tiktok IS NOT NULL THEN
    INSERT INTO public.banned_social_accounts (platform, value, source_email, reason)
    VALUES ('tiktok', public.normalize_social_handle('tiktok', v_tiktok), p_email, p_reason)
    ON CONFLICT (platform, value) DO NOTHING;
  END IF;

  IF v_snapchat IS NOT NULL THEN
    INSERT INTO public.banned_social_accounts (platform, value, source_email, reason)
    VALUES ('snapchat', public.normalize_social_handle('snapchat', v_snapchat), p_email, p_reason)
    ON CONFLICT (platform, value) DO NOTHING;
  END IF;
END;
$$;

-- =============================================================================
-- 3) Trigger: if socials match a banned social, auto-ban by email
-- =============================================================================
DROP FUNCTION IF EXISTS public.user_profiles_auto_ban_on_banned_social();
CREATE OR REPLACE FUNCTION public.user_profiles_auto_ban_on_banned_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_hit_platform text;
BEGIN
  v_email := coalesce(NEW.email, OLD.email);
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NEW;
  END IF;

  -- If any social matches, ban the email.
  IF NEW.instagram IS NOT NULL AND public.normalize_social_handle('instagram', NEW.instagram) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.banned_social_accounts
       WHERE platform = 'instagram'
         AND value = public.normalize_social_handle('instagram', NEW.instagram)
     )
  THEN
    v_hit_platform := 'instagram';
  ELSIF NEW.facebook IS NOT NULL AND public.normalize_social_handle('facebook', NEW.facebook) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.banned_social_accounts
       WHERE platform = 'facebook'
         AND value = public.normalize_social_handle('facebook', NEW.facebook)
     )
  THEN
    v_hit_platform := 'facebook';
  ELSIF NEW.tiktok IS NOT NULL AND public.normalize_social_handle('tiktok', NEW.tiktok) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.banned_social_accounts
       WHERE platform = 'tiktok'
         AND value = public.normalize_social_handle('tiktok', NEW.tiktok)
     )
  THEN
    v_hit_platform := 'tiktok';
  ELSIF NEW.snapchat IS NOT NULL AND public.normalize_social_handle('snapchat', NEW.snapchat) IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.banned_social_accounts
       WHERE platform = 'snapchat'
         AND value = public.normalize_social_handle('snapchat', NEW.snapchat)
     )
  THEN
    v_hit_platform := 'snapchat';
  END IF;

  IF v_hit_platform IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert ban by email (enforced on login + middleware).
  INSERT INTO public.banned_users (email, reason)
  VALUES (lower(trim(v_email)), 'Auto-banned: matched banned ' || v_hit_platform || ' handle')
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_auto_ban_on_banned_social ON public.user_profiles;
CREATE TRIGGER user_profiles_auto_ban_on_banned_social
  AFTER INSERT OR UPDATE OF instagram, facebook, tiktok, snapchat ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_auto_ban_on_banned_social();

-- =============================================================================
-- 4) Patch existing ban functions to snapshot socials before banning/deleting
-- =============================================================================
-- Admin ban + delete
CREATE OR REPLACE FUNCTION public.admin_ban_and_delete_user(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  PERFORM public.record_banned_socials_for_email(p_email, 'Banned by admin');

  INSERT INTO public.banned_users (email, reason)
  VALUES (p_email, 'Banned by admin')
  ON CONFLICT (email) DO NOTHING;

  DELETE FROM public.tickets
  WHERE owner_id IN (SELECT id FROM public.user_profiles WHERE email = p_email);

  DELETE FROM public.user_profiles WHERE email = p_email;
END;
$$;

-- Auto-ban on 3 user reports
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
END;
$$;

-- Auto-ban across listings/tickets scam reports
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
END;
$$;

