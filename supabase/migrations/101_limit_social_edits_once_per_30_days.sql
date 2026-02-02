-- Limit editing connected socials: at most once every 30 days.
-- Enforced in DB (prevents bypassing UI/API).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS socials_last_changed_at timestamptz;

-- Backfill for existing users:
-- - If user completed onboarding, treat that as last change.
-- - If socials already exist but onboarding_completed_at is null (legacy), use updated_at as best-effort.
UPDATE public.user_profiles
SET socials_last_changed_at = onboarding_completed_at
WHERE socials_last_changed_at IS NULL
  AND onboarding_completed_at IS NOT NULL;

UPDATE public.user_profiles
SET socials_last_changed_at = updated_at
WHERE socials_last_changed_at IS NULL
  AND onboarding_completed_at IS NULL
  AND (
    instagram IS NOT NULL OR facebook IS NOT NULL OR tiktok IS NOT NULL OR snapchat IS NOT NULL
  );

DROP TRIGGER IF EXISTS user_profiles_socials_cooldown ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_socials_change_cooldown();

CREATE OR REPLACE FUNCTION public.enforce_socials_change_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed boolean;
  v_next timestamptz;
BEGIN
  -- Admins can bypass (moderation/support).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  v_changed :=
    (NEW.instagram IS DISTINCT FROM OLD.instagram)
    OR (NEW.facebook IS DISTINCT FROM OLD.facebook)
    OR (NEW.tiktok IS DISTINCT FROM OLD.tiktok)
    OR (NEW.snapchat IS DISTINCT FROM OLD.snapchat);

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  IF OLD.socials_last_changed_at IS NOT NULL THEN
    v_next := OLD.socials_last_changed_at + interval '30 days';
    IF now() < v_next THEN
      RAISE EXCEPTION 'You can only update your socials once every 30 days. Next change allowed after %', v_next;
    END IF;
  END IF;

  NEW.socials_last_changed_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_socials_cooldown
  BEFORE UPDATE OF instagram, facebook, tiktok, snapchat ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_socials_change_cooldown();

