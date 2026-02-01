-- Prevent users from changing ARMY profile answers after onboarding is completed.
-- (They can still update socials like instagram/facebook/tiktok/snapchat.)

DROP FUNCTION IF EXISTS public.prevent_army_answers_update_after_onboarding();
CREATE OR REPLACE FUNCTION public.prevent_army_answers_update_after_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce after onboarding is completed.
  IF OLD.onboarding_completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- If these were already set during onboarding, they must not change later.
  IF NEW.army_bias_answer IS DISTINCT FROM OLD.army_bias_answer THEN
    RAISE EXCEPTION 'ARMY profile answers cannot be changed after onboarding';
  END IF;
  IF NEW.army_years_army IS DISTINCT FROM OLD.army_years_army THEN
    RAISE EXCEPTION 'ARMY profile answers cannot be changed after onboarding';
  END IF;
  IF NEW.army_favorite_album IS DISTINCT FROM OLD.army_favorite_album THEN
    RAISE EXCEPTION 'ARMY profile answers cannot be changed after onboarding';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_lock_army_answers ON public.user_profiles;
CREATE TRIGGER user_profiles_lock_army_answers
  BEFORE UPDATE OF army_bias_answer, army_years_army, army_favorite_album ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_army_answers_update_after_onboarding();

