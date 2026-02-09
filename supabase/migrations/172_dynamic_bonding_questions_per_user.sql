-- Make connection bonding questions dynamic per user.
-- For v2 flow (2 questions), each user should:
--   - Reuse their own stored question_ids from user_bonding_answers when available (exactly 2 IDs)
--   - Otherwise, get 2 random question_ids from bonding_questions (active = true).
-- Random pair per user is drawn from bonding_questions (active = true).

DROP FUNCTION IF EXISTS public.get_connection_bonding_question_ids();
CREATE OR REPLACE FUNCTION public.get_connection_bonding_question_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_ids uuid[];
BEGIN
  -- Try to reuse the question IDs already associated with this user's bonding answers (if any).
  v_user := auth.uid();
  IF v_user IS NOT NULL THEN
    SELECT question_ids
    INTO v_ids
    FROM public.user_bonding_answers
    WHERE user_id = v_user
      AND array_length(question_ids, 1) = 2
    LIMIT 1;
  END IF;

  IF v_ids IS NOT NULL AND array_length(v_ids, 1) = 2 THEN
    RETURN v_ids;
  END IF;

  -- Otherwise, pick 2 random questions from the full list (bonding_questions).
  SELECT array_agg(id)
  INTO v_ids
  FROM (
    SELECT id
    FROM public.bonding_questions
    WHERE active = true
    ORDER BY random()
    LIMIT 2
  ) s;

  RETURN COALESCE(v_ids, '{}'::uuid[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_bonding_question_ids() TO authenticated;

