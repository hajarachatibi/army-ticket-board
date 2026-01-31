-- Privacy: prevent non-server clients from selecting user_profiles.email directly.
-- Admin views/RPCs can still access email via SECURITY DEFINER functions.

REVOKE SELECT (email) ON TABLE public.user_profiles FROM anon;
REVOKE SELECT (email) ON TABLE public.user_profiles FROM authenticated;

