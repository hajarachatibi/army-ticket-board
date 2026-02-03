-- Notify story author when their story is published (approved) or when an admin replies.

-- 1) Add story_id to user_notifications and new notification types.
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES public.army_stories(id) ON DELETE SET NULL;

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (
    type IN (
      'ticket_approved',
      'ticket_rejected',
      'connection_request_received',
      'connection_request_accepted',
      'connection_request_declined',
      'connection_bonding_submitted',
      'connection_preview_ready',
      'connection_comfort_updated',
      'connection_social_updated',
      'connection_agreement_updated',
      'connection_match_confirmed',
      'connection_ended',
      'connection_expired',
      'listing_removed_3_reports',
      'story_published',
      'story_admin_replied'
    )
  );

-- 2) Helper to insert story notifications (author only).
CREATE OR REPLACE FUNCTION public.notify_story_user(
  p_user_id uuid,
  p_type text,
  p_story_id uuid,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type NOT IN ('story_published', 'story_admin_replied') THEN
    RAISE EXCEPTION 'Invalid story notification type';
  END IF;
  INSERT INTO public.user_notifications (user_id, type, message, story_id)
  VALUES (p_user_id, p_type, NULLIF(trim(coalesce(p_message, '')), ''), p_story_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_story_user(uuid, text, uuid, text) TO authenticated;

-- 3) Trigger: when a story is approved or when admin_reply is set, notify the author.
CREATE OR REPLACE FUNCTION public.army_stories_notify_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Story just approved (published)
  IF OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved' THEN
    PERFORM public.notify_story_user(
      NEW.author_id,
      'story_published',
      NEW.id,
      'Your story "' || left(nullif(trim(NEW.title), ''), 60) || '" has been published.'
    );
    RETURN NEW;
  END IF;

  -- Admin added or updated a reply (and story is approved so it's visible)
  IF NEW.status = 'approved'
     AND (OLD.admin_reply IS DISTINCT FROM NEW.admin_reply)
     AND NEW.admin_reply IS NOT NULL
     AND trim(NEW.admin_reply) <> '' THEN
    PERFORM public.notify_story_user(
      NEW.author_id,
      'story_admin_replied',
      NEW.id,
      'ARMY Ticket Board team replied to your story "' || left(nullif(trim(NEW.title), ''), 50) || '".'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS army_stories_notify_author_trigger ON public.army_stories;
CREATE TRIGGER army_stories_notify_author_trigger
  AFTER UPDATE ON public.army_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.army_stories_notify_author();

COMMENT ON FUNCTION public.notify_story_user(uuid, text, uuid, text) IS 'Insert a story notification for the story author (published or admin reply).';
