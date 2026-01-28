-- Set admin users and allow admins to SELECT all reports.

UPDATE public.user_profiles
SET role = 'admin'
WHERE email IN ('tomkoods2020@gmail.com', 'achatibihajar@gmail.com');

-- Reports: allow admins to SELECT all (in addition to reporter / ticket owner).
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );
