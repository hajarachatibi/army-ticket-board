-- BTS forum / onboarding questions.
-- Users must submit answers before using the app.

-- 1) Questions (static + dynamic)
CREATE TABLE IF NOT EXISTS public.forum_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  kind text NOT NULL DEFAULT 'dynamic' CHECK (kind IN ('static', 'dynamic')),
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_questions_active_position ON public.forum_questions(active, position, created_at);

-- Keep updated_at in sync (re-use existing helper)
DROP TRIGGER IF EXISTS forum_questions_updated_at ON public.forum_questions;
CREATE TRIGGER forum_questions_updated_at
  BEFORE UPDATE ON public.forum_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Submissions (append-only; latest row is current submission)
CREATE TABLE IF NOT EXISTS public.forum_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_submissions_user_submitted ON public.forum_submissions(user_id, submitted_at DESC);

-- 3) RLS
ALTER TABLE public.forum_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_submissions ENABLE ROW LEVEL SECURITY;

-- forum_questions: authenticated users can SELECT active questions; admins can SELECT all.
DROP POLICY IF EXISTS "forum_questions_select_active" ON public.forum_questions;
CREATE POLICY "forum_questions_select_active"
  ON public.forum_questions FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "forum_questions_select_admin" ON public.forum_questions;
CREATE POLICY "forum_questions_select_admin"
  ON public.forum_questions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- forum_questions: admins can manage.
DROP POLICY IF EXISTS "forum_questions_insert_admin" ON public.forum_questions;
CREATE POLICY "forum_questions_insert_admin"
  ON public.forum_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "forum_questions_update_admin" ON public.forum_questions;
CREATE POLICY "forum_questions_update_admin"
  ON public.forum_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "forum_questions_delete_admin" ON public.forum_questions;
CREATE POLICY "forum_questions_delete_admin"
  ON public.forum_questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- forum_submissions: users can insert/select their own; admins can select all.
DROP POLICY IF EXISTS "forum_submissions_select_own" ON public.forum_submissions;
CREATE POLICY "forum_submissions_select_own"
  ON public.forum_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "forum_submissions_insert_own" ON public.forum_submissions;
CREATE POLICY "forum_submissions_insert_own"
  ON public.forum_submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "forum_submissions_select_admin" ON public.forum_submissions;
CREATE POLICY "forum_submissions_select_admin"
  ON public.forum_submissions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 4) Status helper: do I need to submit (or re-submit if questions changed)?
DROP FUNCTION IF EXISTS public.my_forum_status();
CREATE OR REPLACE FUNCTION public.my_forum_status()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_q AS (
    SELECT COALESCE(max(updated_at), to_timestamp(0)) AS latest_questions_at
    FROM public.forum_questions
    WHERE active = true
  ),
  my_s AS (
    SELECT max(submitted_at) AS submitted_at
    FROM public.forum_submissions
    WHERE user_id = auth.uid()
  )
  SELECT json_build_object(
    'submitted_at', (SELECT submitted_at FROM my_s),
    'latest_questions_at', (SELECT latest_questions_at FROM latest_q),
    'needs_submit',
      (SELECT submitted_at FROM my_s) IS NULL
      OR (SELECT submitted_at FROM my_s) < (SELECT latest_questions_at FROM latest_q)
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_forum_status() TO authenticated;

-- 5) Seed static BTS questions (edit as you like)
INSERT INTO public.forum_questions (prompt, kind, position, active)
SELECT v.prompt, 'static', v.position, true
FROM (
  VALUES
    ('Who is the leader of BTS?', 10),
    ('What does ARMY stand for?', 20),
    ('Name any 2 BTS members.', 30),
    ('What is your favorite BTS song and why?', 40),
    ('What year did BTS debut?', 50)
) AS v(prompt, position)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.forum_questions q
  WHERE q.kind = 'static' AND q.prompt = v.prompt
);

