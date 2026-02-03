-- Prevent direct table read of approved stories so author_username/email cannot be scraped.
-- Approved stories are only exposed via get_approved_stories() RPC (which returns display_author, not raw identity).

DROP POLICY IF EXISTS "army_stories_select_approved" ON public.army_stories;

COMMENT ON FUNCTION public.get_approved_stories() IS 'Only way for non-admins to read approved stories; returns display_author (masked). Direct SELECT on army_stories is no longer allowed for anon/authenticated.';
