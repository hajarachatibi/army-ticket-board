-- Extend connections to cover preview/comfort/social/agreement + support chats for connections.

-- 1) Add comfort stage to allowed stages (keeping existing values).
DO $$
BEGIN
  ALTER TABLE public.connections
    DROP CONSTRAINT IF EXISTS connections_stage_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.connections
  ADD CONSTRAINT connections_stage_check
  CHECK (stage IN ('pending_seller','declined','bonding','preview','comfort','social','agreement','chat_open','ended','expired'));

-- 2) Allow chats to be created from either a request OR a connection.
ALTER TABLE public.chats
  ALTER COLUMN request_id DROP NOT NULL;

-- keep uniqueness for request-backed chats
DROP INDEX IF EXISTS idx_chats_request_id;
-- In Postgres, the unique index is owned by the UNIQUE constraint.
-- Drop the constraint (it will drop the backing index).
ALTER TABLE public.chats DROP CONSTRAINT IF EXISTS chats_request_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chats_request_id_not_null ON public.chats(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS connection_id uuid UNIQUE REFERENCES public.connections(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.chats
    ADD CONSTRAINT chats_request_or_connection
    CHECK (request_id IS NOT NULL OR connection_id IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Maintain last_message_at
DROP FUNCTION IF EXISTS public.touch_chat_last_message();
CREATE OR REPLACE FUNCTION public.touch_chat_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats
  SET last_message_at = now()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_touch_chat ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_chat
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_chat_last_message();

