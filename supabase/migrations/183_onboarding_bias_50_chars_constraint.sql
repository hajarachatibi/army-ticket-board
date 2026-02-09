-- Align onboarding constraint with API: bias answer minimum 50 characters (not 100).
-- Migration 167 inadvertently used 100; API and UI say 50. Users with 50–99 chars were rejected by the DB
-- and saw "complete DB migrations and register socials".

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
      )
      AND length(trim(coalesce(army_bias_answer, ''))) >= 50
      AND length(trim(coalesce(army_years_army, ''))) >= 1
      AND length(trim(coalesce(army_favorite_album, ''))) >= 1
    )
  );
