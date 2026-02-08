-- One-off: mark all existing notifications as push_sent so we only process new ones from now on.
UPDATE public.user_notifications
SET push_sent = true
WHERE push_sent = false;
