-- Recommendations: users submit, admins view in admin panel.

-- Keep admin-only SELECT and DELETE.
DROP POLICY IF EXISTS "admin_recommendations_select_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_select_admin"
  ON public.admin_recommendations FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_recommendations_delete_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_delete_admin"
  ON public.admin_recommendations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Switch INSERT to authenticated non-admin users.
DROP POLICY IF EXISTS "admin_recommendations_insert_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_insert_user"
  ON public.admin_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND author_id = auth.uid()
  );

