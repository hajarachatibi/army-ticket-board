-- ARMY recommendations (internal): only visible in admin panel.

CREATE TABLE IF NOT EXISTS public.admin_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_recommendations_created ON public.admin_recommendations(created_at DESC);

ALTER TABLE public.admin_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_recommendations_select_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_select_admin"
  ON public.admin_recommendations FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_recommendations_insert_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_insert_admin"
  ON public.admin_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND author_id = auth.uid());

DROP POLICY IF EXISTS "admin_recommendations_delete_admin" ON public.admin_recommendations;
CREATE POLICY "admin_recommendations_delete_admin"
  ON public.admin_recommendations FOR DELETE
  TO authenticated
  USING (public.is_admin());

