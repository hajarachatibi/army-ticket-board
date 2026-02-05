-- Allow posting questions anonymously. When not anonymous, show masked identity only (no email), like admin channel replies.

ALTER TABLE public.user_questions
  ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_questions.anonymous IS 'When true, author is shown as "Anonymous". When false, author is shown as masked username (never full email).';

-- Recreate fetch_user_questions: anonymous -> "Anonymous"; not anonymous -> masked label for everyone (private, no email).
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
      q.anonymous,
      CASE
        WHEN q.anonymous THEN 'Anonymous'
        ELSE public.mask_username_for_channel(up.username, up.id)
      END AS author_label
    FROM public.user_questions q
    JOIN public.user_profiles up ON up.id = q.user_id
    ORDER BY q.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_user_questions(int, int) TO authenticated;
