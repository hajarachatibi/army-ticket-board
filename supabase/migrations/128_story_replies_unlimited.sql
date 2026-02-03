-- Unlimited replies per story: replace single admin_reply/author_reply with army_story_replies table.

-- 1) Create replies table
CREATE TABLE IF NOT EXISTS public.army_story_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.army_stories(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reply_type text NOT NULL CHECK (reply_type IN ('admin', 'author')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_story_replies_story_id ON public.army_story_replies(story_id, created_at ASC);

ALTER TABLE public.army_story_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can read replies for approved stories
CREATE POLICY "army_story_replies_select_approved"
  ON public.army_story_replies FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.army_stories s
      WHERE s.id = story_id AND s.status = 'approved'
    )
  );

-- Admins can read all
CREATE POLICY "army_story_replies_select_admin"
  ON public.army_story_replies FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins can insert admin replies
CREATE POLICY "army_story_replies_insert_admin"
  ON public.army_story_replies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND reply_type = 'admin');

-- Story author can insert author replies (only for their approved story)
CREATE POLICY "army_story_replies_insert_author"
  ON public.army_story_replies FOR INSERT TO authenticated
  WITH CHECK (
    reply_type = 'author'
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.army_stories s
      WHERE s.id = story_id AND s.author_id = auth.uid() AND s.status = 'approved'
    )
  );

-- 2) Migrate existing single replies into army_story_replies
INSERT INTO public.army_story_replies (story_id, user_id, reply_type, body, created_at)
SELECT id, admin_replied_by, 'admin', admin_reply, COALESCE(admin_replied_at, updated_at)
FROM public.army_stories
WHERE status = 'approved' AND admin_reply IS NOT NULL AND trim(admin_reply) <> '';

INSERT INTO public.army_story_replies (story_id, user_id, reply_type, body, created_at)
SELECT id, author_id, 'author', author_reply, COALESCE(author_replied_at, updated_at)
FROM public.army_stories
WHERE status = 'approved' AND author_reply IS NOT NULL AND trim(author_reply) <> '';

-- 3) Update get_approved_stories to return replies array (no longer single admin_reply/author_reply)
CREATE OR REPLACE FUNCTION public.get_approved_stories()
RETURNS TABLE (
  id uuid,
  author_id uuid,
  anonymous boolean,
  title text,
  body text,
  status text,
  created_at timestamptz,
  display_author text,
  replies jsonb
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
    CASE
      WHEN s.anonymous THEN 'Anonymous ARMY'::text
      WHEN auth.uid() = s.author_id THEN s.author_username
      WHEN public.is_admin() THEN coalesce(nullif(trim(up.email), ''), s.author_username)
      ELSE public.mask_username_for_channel(s.author_username, s.author_id)
    END AS display_author,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'reply_type', r.reply_type,
          'body', r.body,
          'created_at', r.created_at
        ) ORDER BY r.created_at ASC
      ) FROM public.army_story_replies r WHERE r.story_id = s.id),
      '[]'::jsonb
    ) AS replies
  FROM public.army_stories s
  LEFT JOIN public.user_profiles up ON up.id = s.author_id
  WHERE s.status = 'approved'
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_stories() TO anon;
GRANT EXECUTE ON FUNCTION public.get_approved_stories() TO authenticated;

-- 4) Author adds a reply (unlimited)
CREATE OR REPLACE FUNCTION public.add_story_reply_author(p_story_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF trim(p_body) IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'Reply body is required';
  END IF;
  INSERT INTO public.army_story_replies (story_id, user_id, reply_type, body)
  SELECT p_story_id, auth.uid(), 'author', trim(p_body)
  FROM public.army_stories s
  WHERE s.id = p_story_id AND s.author_id = auth.uid() AND s.status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Story not found or you are not the author or story is not approved';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_story_reply_author(uuid, text) TO authenticated;

-- 5) Admin adds a reply (unlimited); notifies story author
CREATE OR REPLACE FUNCTION public.add_story_reply_admin(p_story_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_title text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT s.author_id, s.title INTO v_author_id, v_title
  FROM public.army_stories s WHERE s.id = p_story_id AND s.status = 'approved';
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Story not found or not approved';
  END IF;
  IF trim(p_body) IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'Reply body is required';
  END IF;
  INSERT INTO public.army_story_replies (story_id, user_id, reply_type, body)
  VALUES (p_story_id, auth.uid(), 'admin', trim(p_body));
  PERFORM public.notify_story_user(
    v_author_id,
    'story_admin_replied',
    p_story_id,
    'ARMY Ticket Board team replied to your story "' || left(nullif(trim(v_title), ''), 50) || '".'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_story_reply_admin(uuid, text) TO authenticated;

-- 6) Drop old trigger that notified on admin_reply (we now notify in add_story_reply_admin)
CREATE OR REPLACE FUNCTION public.army_stories_notify_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved' THEN
    PERFORM public.notify_story_user(
      NEW.author_id,
      'story_published',
      NEW.id,
      'Your story "' || left(nullif(trim(NEW.title), ''), 60) || '" has been published.'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Drop single-reply columns from army_stories
ALTER TABLE public.army_stories
  DROP COLUMN IF EXISTS admin_reply,
  DROP COLUMN IF EXISTS admin_replied_at,
  DROP COLUMN IF EXISTS admin_replied_by,
  DROP COLUMN IF EXISTS author_reply,
  DROP COLUMN IF EXISTS author_replied_at;

-- 8) Drop old RPC (replaced by add_story_reply_author)
DROP FUNCTION IF EXISTS public.set_my_story_reply(uuid, text);

COMMENT ON TABLE public.army_story_replies IS 'Unlimited replies per story: admin and author can each add multiple replies.';
