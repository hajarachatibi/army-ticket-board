-- Private bucket for reports / seller proof (admin-only read via signed URLs).
-- Note: if this fails in Supabase, create the bucket in Dashboard and apply policies manually.

-- 1) Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-attachments', 'proof-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Upload: authenticated users can upload only into their own folder (userId prefix).
DROP POLICY IF EXISTS "Proof attachments: authenticated upload own" ON storage.objects;
CREATE POLICY "Proof attachments: authenticated upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proof-attachments'
    AND (
      name LIKE ('user-reports/' || auth.uid()::text || '/%')
      OR name LIKE ('seller-proof/' || auth.uid()::text || '/%')
    )
  );

-- 3) Read: admins only (required for creating signed URLs too).
DROP POLICY IF EXISTS "Proof attachments: admin read" ON storage.objects;
CREATE POLICY "Proof attachments: admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'proof-attachments' AND public.is_admin());

