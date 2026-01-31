-- Add optional image support to Official Admin Channel posts.
ALTER TABLE public.admin_channel_posts
  ADD COLUMN IF NOT EXISTS image_url text;

-- Optional: basic sanity check (allow null, otherwise non-empty).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_channel_posts_image_url_nonempty'
  ) THEN
    ALTER TABLE public.admin_channel_posts
      ADD CONSTRAINT admin_channel_posts_image_url_nonempty
      CHECK (image_url IS NULL OR length(trim(image_url)) > 0);
  END IF;
END $$;

