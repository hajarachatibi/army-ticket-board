-- Self-sufficient flow: onboarding fields + terms acceptance.
-- Keep columns nullable for existing users; enforce via onboarding_completed_at CHECK.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_18_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS army_bias_answer text,
  ADD COLUMN IF NOT EXISTS army_years_army text,
  ADD COLUMN IF NOT EXISTS army_favorite_album text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_agreement_accepted_at timestamptz;

-- If onboarding_completed_at is set, require required profile fields.
DO $$
BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Helpers for the app to gate access.
DROP FUNCTION IF EXISTS public.my_onboarding_status();
CREATE OR REPLACE FUNCTION public.my_onboarding_status()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'onboarding_completed', (SELECT onboarding_completed_at IS NOT NULL FROM public.user_profiles WHERE id = auth.uid()),
    'terms_accepted', (SELECT terms_accepted_at IS NOT NULL FROM public.user_profiles WHERE id = auth.uid()),
    'user_agreement_accepted', (SELECT user_agreement_accepted_at IS NOT NULL FROM public.user_profiles WHERE id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_onboarding_status() TO authenticated;

