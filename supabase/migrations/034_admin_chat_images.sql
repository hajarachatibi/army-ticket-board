-- Admin chat images: add optional image_url to admin_chat_messages.

ALTER TABLE public.admin_chat_messages
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.admin_chat_messages.image_url IS 'Public URL of image attached to this admin chat message (e.g. Supabase Storage).';

