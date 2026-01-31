-- ARMY feedback / experience stories.
-- - Moderated submissions (pending -> approved/rejected).
-- - Optional anonymous posting.
-- - No ticket resale links (enforced server-side via trigger).

CREATE TABLE IF NOT EXISTS public.army_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  author_username text NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_army_stories_status_created ON public.army_stories(status, created_at DESC);

DROP TRIGGER IF EXISTS army_stories_updated_at ON public.army_stories;
CREATE TRIGGER army_stories_updated_at
  BEFORE UPDATE ON public.army_stories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reject obvious resale links.
DROP FUNCTION IF EXISTS public.reject_resale_links();
CREATE OR REPLACE FUNCTION public.reject_resale_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE txt text;
BEGIN
  txt := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.body, ''));
  IF txt ~ '(https?://|www\.)' THEN
    RAISE EXCEPTION 'Links are not allowed in stories';
  END IF;
  IF txt ~ '(ticketmaster\.com|stubhub\.com|viagogo\.com|seatgeek\.com|vividseats\.com|tickpick\.com)' THEN
    RAISE EXCEPTION 'Ticket resale links are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_army_stories_no_links ON public.army_stories;
CREATE TRIGGER trg_army_stories_no_links
  BEFORE INSERT OR UPDATE ON public.army_stories
  FOR EACH ROW EXECUTE FUNCTION public.reject_resale_links();

ALTER TABLE public.army_stories ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read approved stories.
DROP POLICY IF EXISTS "army_stories_select_approved" ON public.army_stories;
CREATE POLICY "army_stories_select_approved"
  ON public.army_stories FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Admins can read everything.
DROP POLICY IF EXISTS "army_stories_select_admin" ON public.army_stories;
CREATE POLICY "army_stories_select_admin"
  ON public.army_stories FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Authenticated users can insert their own story (pending).
DROP POLICY IF EXISTS "army_stories_insert_own" ON public.army_stories;
CREATE POLICY "army_stories_insert_own"
  ON public.army_stories FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND status = 'pending');

-- Admins can moderate (update/delete).
DROP POLICY IF EXISTS "army_stories_update_admin" ON public.army_stories;
CREATE POLICY "army_stories_update_admin"
  ON public.army_stories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "army_stories_delete_admin" ON public.army_stories;
CREATE POLICY "army_stories_delete_admin"
  ON public.army_stories FOR DELETE
  TO authenticated
  USING (public.is_admin());

