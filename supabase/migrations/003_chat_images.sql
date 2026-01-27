-- Chat images: add image_url to messages, create storage bucket for attachments.
-- Run in Supabase SQL Editor after 002.

-- 1. Add optional image URL to chat messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.chat_messages.image_url IS 'Public URL of image attached to this message (e.g. Supabase Storage).';

-- 2. Create storage bucket for chat images (create manually in Dashboard if this fails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: allow authenticated users to upload images
DROP POLICY IF EXISTS "Chat attachments: authenticated upload" ON storage.objects;
CREATE POLICY "Chat attachments: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- 4. RLS: allow public read (bucket is public)
DROP POLICY IF EXISTS "Chat attachments: public read" ON storage.objects;
CREATE POLICY "Chat attachments: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');
