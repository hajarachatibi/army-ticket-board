-- Fix user_profiles RLS so inserts work with anonymous auth.
-- Anonymous users (signInAnonymously) may use either 'authenticated' or 'anon' role
-- depending on Supabase config. We allow both for INSERT when auth.uid() = id.
-- Run in Supabase SQL Editor after 005.

-- ----------
-- user_profiles: drop existing policies
-- ----------
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

-- ----------
-- user_profiles: SELECT – authenticated can read all (usernames, etc.)
-- ----------
CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- ----------
-- user_profiles: INSERT – own profile only
-- ----------
-- Authenticated (includes most anonymous JWTs):
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

-- Anon (some anonymous auth setups use anon role; auth.uid() still set):
CREATE POLICY "user_profiles_insert_own_anon"
  ON public.user_profiles FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

-- ----------
-- user_profiles: UPDATE – own profile only
-- ----------
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "user_profiles_insert_own" ON public.user_profiles IS 'Allow authenticated users to insert own profile (id = auth.uid()).';
COMMENT ON POLICY "user_profiles_insert_own_anon" ON public.user_profiles IS 'Allow anon role with auth.uid() (e.g. anonymous auth) to insert own profile.';
