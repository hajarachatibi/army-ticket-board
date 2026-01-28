-- Fix "Contacted" check constraint violation when clicking Contact.
-- The chats INSERT trigger used to set ticket status to Contacted; it may still exist if 011 was skipped.
-- Drop it, then fix any bad rows.

DROP TRIGGER IF EXISTS trg_chats_set_ticket_contacted ON public.chats;
DROP FUNCTION IF EXISTS public.set_ticket_contacted_on_chat_insert();

UPDATE public.tickets SET status = 'Available', updated_at = now() WHERE status NOT IN ('Available', 'Sold');
