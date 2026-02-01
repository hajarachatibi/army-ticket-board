-- Allow chats to exist without a legacy ticket/request (for connection-based flow).

ALTER TABLE public.chats
  ALTER COLUMN ticket_id DROP NOT NULL;

-- Optional: keep a FK from connections.chat_id -> chats.id
DO $$
BEGIN
  ALTER TABLE public.connections
    ADD CONSTRAINT connections_chat_id_fk
    FOREIGN KEY (chat_id) REFERENCES public.chats(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

