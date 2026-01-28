-- Add last_login_at to user_profiles. Updated on each OAuth login (auth callback).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN public.user_profiles.last_login_at IS 'Last OAuth sign-in; set in auth callback.'
