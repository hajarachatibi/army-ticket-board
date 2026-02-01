-- Allow admins to manage bonding_questions (used in connection preview/match flow).

ALTER TABLE public.bonding_questions ENABLE ROW LEVEL SECURITY;

-- Admins can read all (active + inactive).
DROP POLICY IF EXISTS "bonding_questions_select_admin" ON public.bonding_questions;
CREATE POLICY "bonding_questions_select_admin"
  ON public.bonding_questions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert.
DROP POLICY IF EXISTS "bonding_questions_insert_admin" ON public.bonding_questions;
CREATE POLICY "bonding_questions_insert_admin"
  ON public.bonding_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update.
DROP POLICY IF EXISTS "bonding_questions_update_admin" ON public.bonding_questions;
CREATE POLICY "bonding_questions_update_admin"
  ON public.bonding_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete.
DROP POLICY IF EXISTS "bonding_questions_delete_admin" ON public.bonding_questions;
CREATE POLICY "bonding_questions_delete_admin"
  ON public.bonding_questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

