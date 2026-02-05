-- Admin: list unanswered questions (no replies) and allow delete.

-- Allow admins to delete any user_questions row (replies are CASCADE deleted).
DROP POLICY IF EXISTS "user_questions_delete_admin" ON public.user_questions;
CREATE POLICY "user_questions_delete_admin"
  ON public.user_questions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Fetch unanswered questions (no rows in user_question_replies). Same shape as fetch_user_questions.
DROP FUNCTION IF EXISTS public.fetch_unanswered_user_questions(int, int);
CREATE OR REPLACE FUNCTION public.fetch_unanswered_user_questions(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
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
        WHEN q.anonymous THEN 'Anonymous'
        ELSE public.mask_username_for_channel(up.username, up.id)
      END AS author_label
    FROM public.user_questions q
    JOIN public.user_profiles up ON up.id = q.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_question_replies r WHERE r.question_id = q.id
    )
    ORDER BY q.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_unanswered_user_questions(int, int) TO authenticated;
