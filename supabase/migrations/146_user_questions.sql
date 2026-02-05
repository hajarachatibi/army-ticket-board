-- User Questions: users post questions, admins reply.
-- Beside Admin Channel so users have a dedicated place for Q&A instead of using channel replies or stories.

CREATE TABLE IF NOT EXISTS public.user_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_questions_created ON public.user_questions(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_question_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.user_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_question_replies_question ON public.user_question_replies(question_id, created_at ASC);

ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_question_replies ENABLE ROW LEVEL SECURITY;

-- Questions: authenticated can read all; any authenticated can insert their own.
DROP POLICY IF EXISTS "user_questions_select" ON public.user_questions;
CREATE POLICY "user_questions_select"
  ON public.user_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_questions_insert_own" ON public.user_questions;
CREATE POLICY "user_questions_insert_own"
  ON public.user_questions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Replies: authenticated can read all; only admins can insert.
DROP POLICY IF EXISTS "user_question_replies_select" ON public.user_question_replies;
CREATE POLICY "user_question_replies_select"
  ON public.user_question_replies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_question_replies_insert_admin" ON public.user_question_replies;
CREATE POLICY "user_question_replies_insert_admin"
  ON public.user_question_replies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

-- Fetch questions with author display: admins see email, others see masked username.
DROP FUNCTION IF EXISTS public.fetch_user_questions(int, int);
CREATE OR REPLACE FUNCTION public.fetch_user_questions(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'data',
    COALESCE(json_agg(x ORDER BY x.created_at DESC), '[]'::json)
  )
  FROM (
    SELECT
      q.id,
      q.user_id,
      q.text,
      q.created_at,
      CASE
        WHEN public.is_admin() THEN coalesce(nullif(trim(up.email), ''), up.username, 'User')
        ELSE public.mask_username_for_channel(up.username, up.id)
      END AS author_label
    FROM public.user_questions q
    JOIN public.user_profiles up ON up.id = q.user_id
    ORDER BY q.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_user_questions(int, int) TO authenticated;

-- Get replies for a question: admin repliers show full email; non-admin (shouldn't happen) masked.
DROP FUNCTION IF EXISTS public.get_user_question_replies(uuid);
CREATE OR REPLACE FUNCTION public.get_user_question_replies(p_question_id uuid)
RETURNS TABLE (
  id uuid,
  question_id uuid,
  user_id uuid,
  text text,
  created_at timestamptz,
  display_label text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.question_id,
    r.user_id,
    r.text,
    r.created_at,
    CASE
      WHEN (coalesce(up.role, '') = 'admin') OR public.is_admin() THEN coalesce(nullif(trim(up.email), ''), up.username, 'Admin')
      ELSE public.mask_username_for_channel(up.username, up.id)
    END AS display_label,
    coalesce(up.role, 'user')::text AS role
  FROM public.user_question_replies r
  JOIN public.user_profiles up ON up.id = r.user_id
  WHERE r.question_id = p_question_id
  ORDER BY r.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_question_replies(uuid) TO authenticated;
