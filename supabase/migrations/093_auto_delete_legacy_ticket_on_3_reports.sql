-- Ensure enforcement matches product rules:
-- - 3 reports on a legacy ticket => automatically delete the ticket (and cascade its reports).
-- - Keep existing scam-ban behavior (3 scam reports => ban owner) and snapshot socials if available.

CREATE OR REPLACE FUNCTION public.auto_enforce_ticket_reports(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_any_count int;
  v_scam_count int;
  v_owner_id uuid;
  v_email text;
BEGIN
  -- Count distinct reporters.
  SELECT count(DISTINCT reporter_id) INTO v_any_count
  FROM public.reports
  WHERE ticket_id = p_ticket_id
    AND reporter_id IS NOT NULL;

  SELECT count(DISTINCT reporter_id) INTO v_scam_count
  FROM public.reports
  WHERE ticket_id = p_ticket_id
    AND reporter_id IS NOT NULL
    AND public.is_scam_reason(reason) = true;

  -- Load owner email once (before deleting).
  SELECT owner_id INTO v_owner_id
  FROM public.tickets
  WHERE id = p_ticket_id;

  IF v_owner_id IS NOT NULL THEN
    SELECT email INTO v_email
    FROM public.user_profiles
    WHERE id = v_owner_id;
  END IF;

  -- Ban owner on scam threshold (if we can resolve email).
  IF COALESCE(v_scam_count, 0) >= 3 AND v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
    -- If the banned-socials migration is present, snapshot socials too (best effort).
    BEGIN
      PERFORM public.record_banned_socials_for_email(v_email, 'Auto-banned: 3 scam reports on a ticket');
    EXCEPTION WHEN undefined_function THEN
      -- ignore (older DB without the social snapshot helper)
      NULL;
    END;

    INSERT INTO public.banned_users (email, reason)
    VALUES (v_email, 'Auto-banned: 3 scam reports on a ticket')
    ON CONFLICT (email) DO NOTHING;
  END IF;

  -- Delete ticket on any 3 reports threshold.
  IF COALESCE(v_any_count, 0) >= 3 THEN
    DELETE FROM public.tickets WHERE id = p_ticket_id;
  END IF;
END;
$$;

