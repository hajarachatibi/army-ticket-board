-- Remove stories that have already been shared (approved and visible to the public).
-- army_story_replies are removed automatically via ON DELETE CASCADE on story_id.

DELETE FROM public.army_stories
WHERE status = 'approved';
