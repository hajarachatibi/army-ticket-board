-- Ban strategy: store banned emails. Check on auth; block access. Admin panel can manage later.

CREATE TABLE IF NOT EXISTS public.banned_users (
  email text PRIMARY KEY,
  banned_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

COMMENT ON TABLE public.banned_users IS 'Banned emails; checked on login. Admin can add/remove later.';

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can check if an email is banned (we only ever query by own email).
DROP POLICY IF EXISTS "banned_users_select" ON public.banned_users;
CREATE POLICY "banned_users_select"
  ON public.banned_users FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/delete (for future admin panel).
DROP POLICY IF EXISTS "banned_users_insert_admin" ON public.banned_users;
CREATE POLICY "banned_users_insert_admin"
  ON public.banned_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "banned_users_delete_admin" ON public.banned_users;
CREATE POLICY "banned_users_delete_admin"
  ON public.banned_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Add the two banned emails (migration runs as superuser, bypasses RLS).
INSERT INTO public.banned_users (email, reason)
VALUES
  ('spreeava182@gmail.com', 'Banned by admin'),
  ('olamilekany226@gmail.com', 'Banned by admin')
ON CONFLICT (email) DO NOTHING;

-- Delete their data: tickets they own, then their profiles (cascades handle requests/chats/messages/reports).
DELETE FROM public.tickets
WHERE owner_id IN (SELECT id FROM public.user_profiles WHERE email IN ('spreeava182@gmail.com', 'olamilekany226@gmail.com'));

DELETE FROM public.user_profiles
WHERE email IN ('spreeava182@gmail.com', 'olamilekany226@gmail.com');
