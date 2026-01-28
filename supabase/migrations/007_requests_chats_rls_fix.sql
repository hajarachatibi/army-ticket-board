-- Fix RLS for requests (Buy) and chats so anonymous auth works.
-- 1. requests: add anon INSERT (mirror user_profiles) for edge cases where anonymous uses anon role.
-- 2. chats: allow buyer OR seller to insert (Buy flow creates chat as buyer, not seller).
-- Run in Supabase SQL Editor after 006.

-- ----------
-- requests: add anon INSERT
-- ----------
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND requester_id = auth.uid());

DROP POLICY IF EXISTS "requests_insert_anon" ON public.requests;
CREATE POLICY "requests_insert_anon"
  ON public.requests FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NOT NULL AND requester_id = auth.uid());

-- ----------
-- chats: allow buyer OR seller to insert (Buy flow creates as buyer)
-- ----------
DROP POLICY IF EXISTS "chats_insert" ON public.chats;
CREATE POLICY "chats_insert"
  ON public.chats FOR INSERT
  TO authenticated
  WITH CHECK (
    (buyer_id = auth.uid() OR seller_id = auth.uid())
  );

DROP POLICY IF EXISTS "chats_insert_anon" ON public.chats;
CREATE POLICY "chats_insert_anon"
  ON public.chats FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NOT NULL AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  );
