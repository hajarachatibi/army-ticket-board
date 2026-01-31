-- Security: prevent users from spoofing admin by updating their own role.

REVOKE UPDATE (role) ON TABLE public.user_profiles FROM anon;
REVOKE UPDATE (role) ON TABLE public.user_profiles FROM authenticated;

