-- Forum questions: show all static + N random dynamic per user.
-- Also reduce re-submit prompting to only changes in static questions.

DROP FUNCTION IF EXISTS public.get_forum_questions_for_user(int);
CREATE OR REPLACE FUNCTION public.get_forum_questions_for_user(p_dynamic_count int DEFAULT 3)
RETURNS TABLE (
  id uuid,
  prompt text,
  kind text,
  "position" int,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH static_q AS (
    SELECT q.*, 0 AS grp, NULL::double precision AS rnd
    FROM public.forum_questions q
    WHERE q.active = true AND q.kind = 'static'
    ORDER BY q.position ASC, q.created_at ASC, q.id ASC
  ),
  dynamic_q AS (
    SELECT q.*, 1 AS grp, random() AS rnd
    FROM public.forum_questions q
    WHERE q.active = true AND q.kind = 'dynamic'
    ORDER BY rnd
    LIMIT GREATEST(0, LEAST(COALESCE(p_dynamic_count, 3), 10))
  )
  SELECT id, prompt, kind, "position", active
  FROM (
    SELECT id, prompt, kind, position AS "position", active, grp, rnd
    FROM static_q
    UNION ALL
    SELECT id, prompt, kind, position AS "position", active, grp, rnd
    FROM dynamic_q
  ) x
  ORDER BY x.grp ASC, x."position" ASC, x.rnd ASC NULLS LAST, x.id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_forum_questions_for_user(int) TO authenticated;

-- Update "needs_submit" so dynamic pool edits don't force everyone to resubmit.
DROP FUNCTION IF EXISTS public.my_forum_status();
CREATE OR REPLACE FUNCTION public.my_forum_status()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_static AS (
    SELECT COALESCE(max(updated_at), to_timestamp(0)) AS latest_questions_at
    FROM public.forum_questions
    WHERE active = true AND kind = 'static'
  ),
  my_s AS (
    SELECT max(submitted_at) AS submitted_at
    FROM public.forum_submissions
    WHERE user_id = auth.uid()
  )
  SELECT json_build_object(
    'submitted_at', (SELECT submitted_at FROM my_s),
    'latest_questions_at', (SELECT latest_questions_at FROM latest_static),
    'needs_submit',
      (SELECT submitted_at FROM my_s) IS NULL
      OR (SELECT submitted_at FROM my_s) < (SELECT latest_questions_at FROM latest_static)
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_forum_status() TO authenticated;

