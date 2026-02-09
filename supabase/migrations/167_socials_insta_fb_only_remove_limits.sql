-- Socials: only Instagram and Facebook. Remove 30-day social cooldown and 48h post limit.

-- 1) Onboarding: require at least one of Instagram OR Facebook (no TikTok/Snapchat).
-- First: clear onboarding for any row that would violate the new constraint (so they re-onboard).
UPDATE public.user_profiles
SET onboarding_completed_at = NULL
WHERE onboarding_completed_at IS NOT NULL
  AND NOT (
    length(trim(coalesce(first_name, ''))) >= 1
    AND length(trim(coalesce(country, ''))) >= 1
    AND is_18_confirmed = true
    AND (length(trim(coalesce(instagram, ''))) >= 1 OR length(trim(coalesce(facebook, ''))) >= 1)
    AND length(trim(coalesce(army_bias_answer, ''))) >= 100
    AND length(trim(coalesce(army_years_army, ''))) >= 1
    AND length(trim(coalesce(army_favorite_album, ''))) >= 1
  );

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
      AND length(trim(coalesce(army_bias_answer, ''))) >= 100
      AND length(trim(coalesce(army_years_army, ''))) >= 1
      AND length(trim(coalesce(army_favorite_album, ''))) >= 1
    )
  );

-- 2) Remove 30-day social change limit (drop trigger and function).
DROP TRIGGER IF EXISTS user_profiles_socials_cooldown ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_socials_change_cooldown();

-- 3) Remove 48-hour posting limit (drop trigger and function).
DROP TRIGGER IF EXISTS listings_enforce_post_limit_48h ON public.listings;
DROP FUNCTION IF EXISTS public.enforce_seller_post_limit_48h();
