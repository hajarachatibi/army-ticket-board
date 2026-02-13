-- Support page one-year cost progress: single row (target, current, visible).
-- Public can read when visible = true; only admins can read full row and update.

CREATE TABLE IF NOT EXISTS public.support_progress (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  target_amount_cents bigint NOT NULL DEFAULT 0,
  current_amount_cents bigint NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure single row exists
INSERT INTO public.support_progress (id, target_amount_cents, current_amount_cents, visible)
VALUES (1, 0, 0, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.support_progress ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can read only when visible = true
DROP POLICY IF EXISTS "support_progress_select_visible" ON public.support_progress;
CREATE POLICY "support_progress_select_visible"
  ON public.support_progress FOR SELECT TO anon, authenticated
  USING (visible = true);

-- No direct INSERT/UPDATE/DELETE from client; only via admin RPCs below.

-- Admin: get full row (including when visible = false)
CREATE OR REPLACE FUNCTION public.admin_get_support_progress()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.support_progress;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO r FROM public.support_progress WHERE id = 1;
  RETURN json_build_object(
    'target_amount_cents', r.target_amount_cents,
    'current_amount_cents', r.current_amount_cents,
    'visible', r.visible,
    'updated_at', r.updated_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_support_progress() TO authenticated;

-- Admin: set target, current, and visibility (percentage is derived: current/target when target > 0)
CREATE OR REPLACE FUNCTION public.admin_set_support_progress(
  p_target_amount_cents bigint,
  p_current_amount_cents bigint,
  p_visible boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_target_amount_cents < 0 OR p_current_amount_cents < 0 THEN
    RAISE EXCEPTION 'Amounts must be non-negative';
  END IF;
  UPDATE public.support_progress
  SET target_amount_cents = p_target_amount_cents,
      current_amount_cents = p_current_amount_cents,
      visible = p_visible,
      updated_at = now()
  WHERE id = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_support_progress(bigint, bigint, boolean) TO authenticated;

-- Public: get progress when visible (for support page). Returns null if hidden.
CREATE OR REPLACE FUNCTION public.get_support_progress()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'target_amount_cents', target_amount_cents,
    'current_amount_cents', current_amount_cents
  )
  FROM public.support_progress
  WHERE id = 1 AND visible = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_support_progress() TO anon;
GRANT EXECUTE ON FUNCTION public.get_support_progress() TO authenticated;

COMMENT ON TABLE public.support_progress IS 'Single row: one-year cost progress for support page. Admin-managed.';
COMMENT ON FUNCTION public.get_support_progress() IS 'Public: returns target and current when progress bar is visible.';
COMMENT ON FUNCTION public.admin_get_support_progress() IS 'Admin: returns full support progress settings.';
COMMENT ON FUNCTION public.admin_set_support_progress(bigint, bigint, boolean) IS 'Admin: set target (cents), current (cents), and visible.';
