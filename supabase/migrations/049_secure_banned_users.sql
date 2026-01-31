-- Tighten banned_users privacy:
-- - Only admins can SELECT the table directly.
-- - Everyone else uses a SECURITY DEFINER RPC to check a single email.

-- Replace broad SELECT policy.
DROP POLICY IF EXISTS "banned_users_select" ON public.banned_users;
CREATE POLICY "banned_users_select_admin_only"
  ON public.banned_users FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Safe check RPC (does not expose full list).
DROP FUNCTION IF EXISTS public.is_email_banned(text);
CREATE OR REPLACE FUNCTION public.is_email_banned(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.banned_users b
    WHERE lower(b.email) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_banned(text) TO authenticated;

