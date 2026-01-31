-- Seller proof applications: required before admins approve future ticket submissions.
CREATE TABLE IF NOT EXISTS public.seller_proof_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  country text NOT NULL,
  platform text NOT NULL,
  proof_details text NOT NULL,
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_proof_user ON public.seller_proof_applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_proof_status ON public.seller_proof_applications(status, created_at DESC);

ALTER TABLE public.seller_proof_applications ENABLE ROW LEVEL SECURITY;

-- Users can see their own submissions.
DROP POLICY IF EXISTS "seller_proof_select_own" ON public.seller_proof_applications;
CREATE POLICY "seller_proof_select_own"
  ON public.seller_proof_applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Users can submit their own (all fields required by schema).
DROP POLICY IF EXISTS "seller_proof_insert_own" ON public.seller_proof_applications;
CREATE POLICY "seller_proof_insert_own"
  ON public.seller_proof_applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can update status / notes.
DROP POLICY IF EXISTS "seller_proof_update_admin" ON public.seller_proof_applications;
CREATE POLICY "seller_proof_update_admin"
  ON public.seller_proof_applications FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Simple updated_at trigger (reuse if exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_seller_proof_updated_at ON public.seller_proof_applications;
    CREATE TRIGGER trg_seller_proof_updated_at
      BEFORE UPDATE ON public.seller_proof_applications
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Viewer RPC: do I have an approved proof?
DROP FUNCTION IF EXISTS public.my_seller_proof_status();
CREATE OR REPLACE FUNCTION public.my_seller_proof_status()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'latest_status',
      (SELECT spa.status
       FROM public.seller_proof_applications spa
       WHERE spa.user_id = auth.uid()
       ORDER BY spa.created_at DESC
       LIMIT 1),
    'has_approved',
      EXISTS (
        SELECT 1
        FROM public.seller_proof_applications spa
        WHERE spa.user_id = auth.uid() AND spa.status = 'approved'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_seller_proof_status() TO authenticated;

