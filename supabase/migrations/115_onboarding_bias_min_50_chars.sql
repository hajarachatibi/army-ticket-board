-- Reduce minimum length for army_bias_answer from 100 to 50 characters.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_onboarding_required_fields;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_onboarding_required_fields
  CHECK (
    onboarding_completed_at IS NULL
    OR (
      length(trim(coalesce(first_name, ''))) >= 1
      AND length(trim(coalesce(country, ''))) >= 1
      AND is_18_confirmed = true
      AND (
        length(trim(coalesce(instagram, ''))) >= 1
        OR length(trim(coalesce(facebook, ''))) >= 1
        OR length(trim(coalesce(tiktok, ''))) >= 1
        OR length(trim(coalesce(snapchat, ''))) >= 1
      )
      AND length(trim(coalesce(army_bias_answer, ''))) >= 50
      AND length(trim(coalesce(army_years_army, ''))) >= 1
      AND length(trim(coalesce(army_favorite_album, ''))) >= 1
    )
  );
