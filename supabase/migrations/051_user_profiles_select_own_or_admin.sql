-- Restrict user_profiles SELECT:
-- - Users can read their own profile row
-- - Admins can read all

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own_or_admin"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

