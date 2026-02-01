-- Add TikTok + Snapchat as acceptable socials for onboarding.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS snapchat text;

-- Update onboarding constraint to accept any of: instagram/facebook/tiktok/snapchat.
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
      AND length(trim(coalesce(army_bias_answer, ''))) >= 100
      AND length(trim(coalesce(army_years_army, ''))) >= 1
      AND length(trim(coalesce(army_favorite_album, ''))) >= 1
    )
  );

