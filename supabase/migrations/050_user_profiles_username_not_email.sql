-- Usernames must not be emails (privacy).
-- Migrate existing usernames containing '@' to a masked form.

UPDATE public.user_profiles up
SET username = (
  CASE
    WHEN up.username IS NULL OR length(trim(up.username)) = 0 THEN
      'ARMY-' || right(up.id::text, 4)
    WHEN position('@' in up.username) > 0 THEN
      left(split_part(up.username, '@', 1), 1) || '***-' || right(up.id::text, 4)
    ELSE
      trim(up.username)
  END
)
WHERE up.username IS NULL
   OR length(trim(up.username)) = 0
   OR position('@' in up.username) > 0;

-- Enforce: no '@' in username.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_username_not_email'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_username_not_email
      CHECK (position('@' in username) = 0);
  END IF;
END $$;

