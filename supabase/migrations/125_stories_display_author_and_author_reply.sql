-- 1) Author reply: only story owner can set (via RPC). Admins set admin_reply (existing).
ALTER TABLE public.army_stories
  ADD COLUMN IF NOT EXISTS author_reply text,
  ADD COLUMN IF NOT EXISTS author_replied_at timestamptz;

COMMENT ON COLUMN public.army_stories.author_reply IS 'Optional reply from the story author (only they can set it, when story is approved).';
COMMENT ON COLUMN public.army_stories.author_replied_at IS 'When the author reply was added or last updated.';

-- 2) RPC: approved stories with display_author (masked for non-admins; admins see email).
--    Protects author email/identity; only admins and story owner see full identity.
CREATE OR REPLACE FUNCTION public.get_approved_stories()
RETURNS TABLE (
  id uuid,
  author_id uuid,
  anonymous boolean,
  title text,
  body text,
  status text,
  created_at timestamptz,
  admin_reply text,
  admin_replied_at timestamptz,
  author_reply text,
  author_replied_at timestamptz,
  display_author text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.author_id,
    s.anonymous,
    s.title,
    s.body,
    s.status,
    s.created_at,
    s.admin_reply,
    s.admin_replied_at,
    s.author_reply,
    s.author_replied_at,
    CASE
      WHEN s.anonymous THEN 'Anonymous ARMY'::text
      WHEN auth.uid() = s.author_id THEN s.author_username
      WHEN public.is_admin() THEN coalesce(nullif(trim(up.email), ''), s.author_username)
      ELSE public.mask_username_for_channel(s.author_username, s.author_id)
    END AS display_author
  FROM public.army_stories s
  LEFT JOIN public.user_profiles up ON up.id = s.author_id
  WHERE s.status = 'approved'
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_stories() TO anon;
GRANT EXECUTE ON FUNCTION public.get_approved_stories() TO authenticated;

COMMENT ON FUNCTION public.get_approved_stories() IS 'Approved stories with display_author: masked for non-admins (email protected); admins and story owner see full identity.';

-- 3) RPC: story owner can set their own reply (only on approved stories).
CREATE OR REPLACE FUNCTION public.set_my_story_reply(p_story_id uuid, p_reply text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.army_stories
  SET
    author_reply = nullif(trim(p_reply), ''),
    author_replied_at = CASE WHEN nullif(trim(p_reply), '') IS NOT NULL THEN now() ELSE NULL END
  WHERE id = p_story_id
    AND author_id = auth.uid()
    AND status = 'approved';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_story_reply(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.set_my_story_reply(uuid, text) IS 'Story owner can set or clear their reply on their own approved story.';
