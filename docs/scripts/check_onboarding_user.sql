-- Run in Supabase SQL Editor to inspect why a user is stuck on "Finish setup".
-- Replace 'baby8684@gmail.com' with the user's email.

-- 1) Find auth user and profile
SELECT
  u.id AS auth_id,
  u.email,
  up.id AS profile_id,
  up.username,
  up.first_name,
  up.country,
  up.is_18_confirmed,
  up.instagram,
  up.facebook,
  up.army_bias_answer IS NOT NULL AND length(trim(coalesce(up.army_bias_answer, ''))) >= 1 AS has_bias,
  up.army_years_army IS NOT NULL AND length(trim(coalesce(up.army_years_army, ''))) >= 1 AS has_years,
  up.army_favorite_album IS NOT NULL AND length(trim(coalesce(up.army_favorite_album, ''))) >= 1 AS has_album,
  up.onboarding_completed_at,
  up.terms_accepted_at,
  up.user_agreement_accepted_at
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
WHERE u.email = 'baby8684@gmail.com';

-- If profile_id is NULL: the user has no user_profiles row. After deploying the upsert fix,
-- have them submit "Finish setup" again; the API will create the row and set onboarding_completed_at.

-- If profile exists but onboarding_completed_at is NULL and required fields are filled,
-- you can mark setup complete manually (optional; or have them resubmit after deploy):
/*
UPDATE public.user_profiles
SET
  onboarding_completed_at = now(),
  terms_accepted_at = COALESCE(terms_accepted_at, now()),
  user_agreement_accepted_at = COALESCE(user_agreement_accepted_at, now())
WHERE id = (SELECT id FROM auth.users WHERE email = 'baby8684@gmail.com')
  AND onboarding_completed_at IS NULL
  AND length(trim(coalesce(first_name, ''))) >= 1
  AND length(trim(coalesce(country, ''))) >= 1
  AND is_18_confirmed = true
  AND (length(trim(coalesce(instagram, ''))) >= 1 OR length(trim(coalesce(facebook, ''))) >= 1)
  AND length(trim(coalesce(army_bias_answer, ''))) >= 1
  AND length(trim(coalesce(army_years_army, ''))) >= 1
  AND length(trim(coalesce(army_favorite_album, ''))) >= 1;
*/
