-- Army Ticket Board – Supabase schema, relationships, and RLS
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query → paste → Run.
--
-- IMPORTANT:
-- - Do NOT add a trigger on auth.users that inserts into user_profiles. We create
--   profiles from the client after signup. Such a trigger caused "Database error
--   saving new user" in the past.
-- - DB uses snake_case (e.g. seat_row, ticket_id). Map to camelCase when linking.

-- =============================================================================
-- 0. CLEANUP – Drop existing objects before recreate
-- =============================================================================
-- Run first so you can re-run this migration on a DB that already has similar
-- tables. Order: drop dependents first (tables that reference others). CASCADE
-- drops triggers, indexes, RLS policies, and FKs.

DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- =============================================================================
-- 1. USER PROFILES (extends auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);

COMMENT ON TABLE public.user_profiles IS 'Profile for each auth user; id = auth.users.id';

-- =============================================================================
-- 2. TICKETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  city text NOT NULL,
  day date NOT NULL,
  vip boolean NOT NULL DEFAULT false,
  quantity int NOT NULL CHECK (quantity >= 1),
  section text NOT NULL,
  seat_row text NOT NULL,
  seat text NOT NULL,
  type text NOT NULL CHECK (type IN ('Seat', 'Standing')),
  status text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Requested', 'Reported', 'Sold')),
  owner_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_owner_id ON public.tickets(owner_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_event_city_day ON public.tickets(event, city, day);

COMMENT ON TABLE public.tickets IS 'Listed tickets; owner_id = seller.';
COMMENT ON COLUMN public.tickets.seat_row IS 'Maps to "row" in app (reserved word in SQL).';

-- =============================================================================
-- 3. REQUESTS (buyer requests a ticket; seller accepts/rejects/closes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  requester_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'closed')),
  accepted_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  event text NOT NULL,
  seat_preference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_ticket_id ON public.requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON public.requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);

COMMENT ON TABLE public.requests IS 'Buyer requests; one accepted per ticket at a time (enforced in app).';

-- =============================================================================
-- 4. CHATS (one per accepted request)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.requests(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  buyer_username text NOT NULL,
  seller_username text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  ticket_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chats_ticket_id ON public.chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_chats_buyer_seller ON public.chats(buyer_id, seller_id);

COMMENT ON TABLE public.chats IS 'One chat per accepted request; seller can close.';

-- =============================================================================
-- 5. CHAT MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_username text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON public.chat_messages(chat_id);

COMMENT ON TABLE public.chat_messages IS 'Messages within a chat.';

-- =============================================================================
-- 6. REPORTS (stored for admin review; email sent via API)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reported_by_username text,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_ticket_id ON public.reports(ticket_id);

COMMENT ON TABLE public.reports IS 'Ticket reports; admin notified by email.';

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ----------
-- user_profiles
-- ----------
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------
-- tickets (browse allowed without login)
-- ----------
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select"
  ON public.tickets FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tickets_update_owner" ON public.tickets;
CREATE POLICY "tickets_update_owner"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tickets_delete_owner" ON public.tickets;
CREATE POLICY "tickets_delete_owner"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ----------
-- requests
-- ----------
DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select"
  ON public.requests FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid()
    OR accepted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.owner_id = auth.uid()
    )
  );

-- ----------
-- chats
-- ----------
DROP POLICY IF EXISTS "chats_select" ON public.chats;
CREATE POLICY "chats_select"
  ON public.chats FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS "chats_insert" ON public.chats;
CREATE POLICY "chats_insert"
  ON public.chats FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "chats_update" ON public.chats;
CREATE POLICY "chats_update"
  ON public.chats FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ----------
-- chat_messages
-- ----------
DROP POLICY IF EXISTS "chat_messages_select" ON public.chat_messages;
CREATE POLICY "chat_messages_select"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_insert"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()) AND c.status = 'open'
    )
  );

-- ----------
-- reports
-- ----------
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- =============================================================================
-- 8. HELPER: update updated_at on tickets
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS requests_updated_at ON public.requests;
CREATE TRIGGER requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 9. DONE
-- =============================================================================
-- Tickets SELECT: anon + authenticated (browse without login).
-- All other tables: authenticated only. user_profiles insert = own id only.
