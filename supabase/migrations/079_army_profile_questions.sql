-- Admin-managed ARMY profile questions (used in onboarding).

CREATE TABLE IF NOT EXISTS public.army_profile_questions (
  key text PRIMARY KEY,
  prompt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS army_profile_questions_updated_at ON public.army_profile_questions;
CREATE TRIGGER army_profile_questions_updated_at
  BEFORE UPDATE ON public.army_profile_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (idempotent)
INSERT INTO public.army_profile_questions(key, prompt, active, position)
VALUES
  ('bias', 'Who is your bias? Why? (min 100 chars)', true, 1),
  ('years_army', 'How many years have you been ARMY?', true, 2),
  ('favorite_album', 'What is your favorite BTS album?', true, 3)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.army_profile_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "army_profile_questions_select" ON public.army_profile_questions;
CREATE POLICY "army_profile_questions_select"
  ON public.army_profile_questions FOR SELECT
  TO authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "army_profile_questions_insert_admin" ON public.army_profile_questions;
CREATE POLICY "army_profile_questions_insert_admin"
  ON public.army_profile_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "army_profile_questions_update_admin" ON public.army_profile_questions;
CREATE POLICY "army_profile_questions_update_admin"
  ON public.army_profile_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "army_profile_questions_delete_admin" ON public.army_profile_questions;
CREATE POLICY "army_profile_questions_delete_admin"
  ON public.army_profile_questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP FUNCTION IF EXISTS public.get_army_profile_questions();
CREATE OR REPLACE FUNCTION public.get_army_profile_questions()
RETURNS TABLE(key text, prompt text, active boolean, "position" int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.key, q.prompt, q.active, q.position AS "position"
  FROM public.army_profile_questions q
  WHERE q.active = true
  ORDER BY q."position" ASC, q.key ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_army_profile_questions() TO authenticated;

