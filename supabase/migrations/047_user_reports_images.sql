-- Optional picture proof for user reports.
ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_reports_image_url_nonempty'
  ) THEN
    ALTER TABLE public.user_reports
      ADD CONSTRAINT user_reports_image_url_nonempty
      CHECK (image_url IS NULL OR length(trim(image_url)) > 0);
  END IF;
END $$;

