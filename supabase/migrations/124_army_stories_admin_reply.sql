-- Allow admins to comment/answer on published ARMY stories. Reply is shown under the story on the public page.

ALTER TABLE public.army_stories
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_replied_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.army_stories.admin_reply IS 'Optional admin comment/answer shown under the story when published.';
COMMENT ON COLUMN public.army_stories.admin_replied_at IS 'When the admin reply was added or last updated.';
COMMENT ON COLUMN public.army_stories.admin_replied_by IS 'Admin who wrote the reply (optional).';
