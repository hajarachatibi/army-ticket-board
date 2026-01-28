-- Fix RLS for tickets and reports so anonymous auth works (Sell, Report).
-- Add anon INSERT (mirror user_profiles/requests). Run after 007.

-- ----------
-- tickets: add anon INSERT
-- ----------
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

DROP POLICY IF EXISTS "tickets_insert_anon" ON public.tickets;
CREATE POLICY "tickets_insert_anon"
  ON public.tickets FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

-- ----------
-- tickets: add anon UPDATE/DELETE (edit, mark sold, delete)
-- ----------
DROP POLICY IF EXISTS "tickets_update_owner" ON public.tickets;
CREATE POLICY "tickets_update_owner"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tickets_update_owner_anon" ON public.tickets;
CREATE POLICY "tickets_update_owner_anon"
  ON public.tickets FOR UPDATE
  TO anon
  USING (auth.uid() IS NOT NULL AND owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tickets_delete_owner" ON public.tickets;
CREATE POLICY "tickets_delete_owner"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "tickets_delete_owner_anon" ON public.tickets;
CREATE POLICY "tickets_delete_owner_anon"
  ON public.tickets FOR DELETE
  TO anon
  USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- ----------
-- reports: add anon INSERT
-- ----------
DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_insert_anon" ON public.reports;
CREATE POLICY "reports_insert_anon"
  ON public.reports FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NOT NULL AND reporter_id = auth.uid());
