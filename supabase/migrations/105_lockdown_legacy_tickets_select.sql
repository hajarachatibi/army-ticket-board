-- Lock down legacy `public.tickets` so it can't be read anonymously.
-- Otherwise anyone can query it via Supabase REST using the public anon key.

-- Remove public browsing access (anon SELECT).
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;

-- Allow only the ticket owner (and admins) to read legacy tickets.
CREATE POLICY "tickets_select_owner_or_admin"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

