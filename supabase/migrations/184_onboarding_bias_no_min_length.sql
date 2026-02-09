-- Remove minimum character limit on army_bias_answer; only require non-empty.

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
      AND length(trim(coalesce(army_bias_answer, ''))) >= 1
      AND length(trim(coalesce(army_years_army, ''))) >= 1
      AND length(trim(coalesce(army_favorite_album, ''))) >= 1
    )
  );

-- Update bias question prompt to remove character limit text
UPDATE public.army_profile_questions
SET prompt = 'Who is your bias? Why?'
WHERE key = 'bias' AND prompt LIKE '%min 100 chars%';
