-- User reports: report a user (e.g. scammer in chat) even without a ticket.

CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reported_by_username text,
  reason text NOT NULL,
  details text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user_id ON public.user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON public.user_reports(reporter_id);

COMMENT ON TABLE public.user_reports IS 'User-to-user reports (e.g. scammer pretending to be admin).';

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can view their own reports; admins can view all.
DROP POLICY IF EXISTS "user_reports_select" ON public.user_reports;
CREATE POLICY "user_reports_select"
  ON public.user_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- Anyone signed in can report a user.
DROP POLICY IF EXISTS "user_reports_insert" ON public.user_reports;
CREATE POLICY "user_reports_insert"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Admin list for UI
CREATE OR REPLACE FUNCTION public.admin_user_reports_with_details()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  FROM (
    SELECT
      ur.id,
      ur.reported_user_id,
      up_reported.email AS reported_email,
      ur.reporter_id,
      up_reporter.email AS reporter_email,
      ur.reported_by_username,
      ur.reason,
      ur.details,
      ur.image_url,
      ur.created_at
    FROM public.user_reports ur
    LEFT JOIN public.user_profiles up_reported ON up_reported.id = ur.reported_user_id
    LEFT JOIN public.user_profiles up_reporter ON up_reporter.id = ur.reporter_id
    WHERE EXISTS (SELECT 1 FROM public.user_profiles a WHERE a.id = auth.uid() AND a.role = 'admin')
    ORDER BY ur.created_at DESC
  ) r;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_reports_with_details() TO authenticated;

