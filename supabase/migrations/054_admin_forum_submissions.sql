-- Admin review of BTS forum submissions.
-- Returns latest submission per user with email + answers for manual review.

DROP FUNCTION IF EXISTS public.admin_forum_submissions_with_details();
CREATE OR REPLACE FUNCTION public.admin_forum_submissions_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(x ORDER BY x.submitted_at DESC), '[]'::json)
  FROM (
    SELECT DISTINCT ON (fs.user_id)
      fs.id,
      fs.user_id,
      up.email AS user_email,
      up.username AS username,
      fs.answers,
      fs.submitted_at
    FROM public.forum_submissions fs
    JOIN public.user_profiles up ON up.id = fs.user_id
    WHERE public.is_admin()
    ORDER BY fs.user_id, fs.submitted_at DESC
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.admin_forum_submissions_with_details() TO authenticated;

