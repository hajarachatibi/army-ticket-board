-- Chatroom: add chat_username for community chat display name; add community chat messages and reactions.
-- Only signed-in users can use community chat; chat_username is set when they first enter.

-- 1) Chat username on user_profiles (nullable until user sets it in community chat)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS chat_username text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_chat_username
  ON public.user_profiles(chat_username)
  WHERE chat_username IS NOT NULL AND trim(chat_username) <> '';

COMMENT ON COLUMN public.user_profiles.chat_username IS 'Display name in community chat; set on first visit to community chat.';

-- 2) Community chat messages (all signed-in users can read/write)
CREATE TABLE IF NOT EXISTS public.community_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_chat_messages_created
  ON public.community_chat_messages(created_at DESC);

ALTER TABLE public.community_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_chat_messages_select" ON public.community_chat_messages;
CREATE POLICY "community_chat_messages_select"
  ON public.community_chat_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_chat_messages_insert" ON public.community_chat_messages;
CREATE POLICY "community_chat_messages_insert"
  ON public.community_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_chat_messages_delete_own" ON public.community_chat_messages;
CREATE POLICY "community_chat_messages_delete_own"
  ON public.community_chat_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3) Community chat reactions: purple heart (💜), haha (😂), dislike (👎) per message per user
CREATE TABLE IF NOT EXISTS public.community_chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('💜', '😂', '👎')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_community_chat_reactions_message
  ON public.community_chat_reactions(message_id);

ALTER TABLE public.community_chat_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_chat_reactions_select" ON public.community_chat_reactions;
CREATE POLICY "community_chat_reactions_select"
  ON public.community_chat_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_chat_reactions_insert" ON public.community_chat_reactions;
CREATE POLICY "community_chat_reactions_insert"
  ON public.community_chat_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_chat_reactions_delete_own" ON public.community_chat_reactions;
CREATE POLICY "community_chat_reactions_delete_own"
  ON public.community_chat_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4) RPC: fetch community chat messages with author display name, admin flag, and reaction counts
DROP FUNCTION IF EXISTS public.fetch_community_chat_messages(int, int);
CREATE OR REPLACE FUNCTION public.fetch_community_chat_messages(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'data',
    COALESCE(json_agg(x ORDER BY x.created_at ASC), '[]'::json)
  )
  FROM (
    SELECT
      m.id,
      m.user_id,
      m.text,
      m.image_url,
      m.created_at,
      COALESCE(NULLIF(trim(up.chat_username), ''), up.username) AS author_display_name,
      (up.role = 'admin') AS author_is_admin,
      (SELECT json_object_agg(emoji, cnt) FROM (
        SELECT emoji, count(*)::int AS cnt
        FROM public.community_chat_reactions r
        WHERE r.message_id = m.id
        GROUP BY emoji
      ) agg) AS reaction_counts
    FROM public.community_chat_messages m
    JOIN public.user_profiles up ON up.id = m.user_id
    ORDER BY m.created_at DESC
    LIMIT greatest(1, least(100, p_limit)) OFFSET greatest(0, p_offset)
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_community_chat_messages(int, int) TO authenticated;

-- 5) Realtime for community chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_chat_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_chat_reactions;
  END IF;
END $$;
