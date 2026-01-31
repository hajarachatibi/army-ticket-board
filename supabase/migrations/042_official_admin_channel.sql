-- Official Admin Channel (broadcast):
-- - Admins create posts (announcements).
-- - Users can read.
-- - Users can react and reply (optional per product requirement).

CREATE TABLE IF NOT EXISTS public.admin_channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_channel_posts_created ON public.admin_channel_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_channel_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.admin_channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_admin_channel_reactions_post ON public.admin_channel_reactions(post_id);

CREATE TABLE IF NOT EXISTS public.admin_channel_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.admin_channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_channel_replies_post_created ON public.admin_channel_replies(post_id, created_at ASC);

ALTER TABLE public.admin_channel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_channel_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_channel_replies ENABLE ROW LEVEL SECURITY;

-- Posts: everyone authenticated can read, only admins can write.
DROP POLICY IF EXISTS "admin_channel_posts_select" ON public.admin_channel_posts;
CREATE POLICY "admin_channel_posts_select"
  ON public.admin_channel_posts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_channel_posts_insert_admin" ON public.admin_channel_posts;
CREATE POLICY "admin_channel_posts_insert_admin"
  ON public.admin_channel_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND author_id = auth.uid());

DROP POLICY IF EXISTS "admin_channel_posts_update_admin" ON public.admin_channel_posts;
CREATE POLICY "admin_channel_posts_update_admin"
  ON public.admin_channel_posts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_channel_posts_delete_admin" ON public.admin_channel_posts;
CREATE POLICY "admin_channel_posts_delete_admin"
  ON public.admin_channel_posts FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Reactions: authenticated can read; users manage their own reactions.
DROP POLICY IF EXISTS "admin_channel_reactions_select" ON public.admin_channel_reactions;
CREATE POLICY "admin_channel_reactions_select"
  ON public.admin_channel_reactions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_channel_reactions_insert_own" ON public.admin_channel_reactions;
CREATE POLICY "admin_channel_reactions_insert_own"
  ON public.admin_channel_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_channel_reactions_delete_own" ON public.admin_channel_reactions;
CREATE POLICY "admin_channel_reactions_delete_own"
  ON public.admin_channel_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Replies: authenticated can read; users can write/delete their own.
DROP POLICY IF EXISTS "admin_channel_replies_select" ON public.admin_channel_replies;
CREATE POLICY "admin_channel_replies_select"
  ON public.admin_channel_replies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_channel_replies_insert_own" ON public.admin_channel_replies;
CREATE POLICY "admin_channel_replies_insert_own"
  ON public.admin_channel_replies FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_channel_replies_delete_own" ON public.admin_channel_replies;
CREATE POLICY "admin_channel_replies_delete_own"
  ON public.admin_channel_replies FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Fetch posts with author info and aggregates (email shown because authors are admins).
DROP FUNCTION IF EXISTS public.fetch_admin_channel_posts(int, int);
CREATE OR REPLACE FUNCTION public.fetch_admin_channel_posts(p_limit int DEFAULT 20, p_offset int DEFAULT 0)
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
      p.id,
      p.text,
      p.image_url,
      p.created_at,
      up.id AS author_id,
      up.username AS author_username,
      up.email AS author_email,
      (up.role = 'admin') AS author_is_admin,
      (SELECT count(*)::int FROM admin_channel_replies r WHERE r.post_id = p.id) AS replies_count,
      (SELECT count(*)::int FROM admin_channel_reactions rx WHERE rx.post_id = p.id) AS reactions_count
    FROM admin_channel_posts p
    JOIN user_profiles up ON up.id = p.author_id
    ORDER BY p.created_at DESC
    LIMIT greatest(0, p_limit) OFFSET greatest(0, p_offset)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_admin_channel_posts(int, int) TO authenticated;

-- Add to realtime publication (optional live updates).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_channel_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_channel_posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_channel_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_channel_reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_channel_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_channel_replies;
  END IF;
END $$;

