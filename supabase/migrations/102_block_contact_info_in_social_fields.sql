-- Prevent users from putting contact info in social fields.
-- Enforced in DB to prevent bypassing UI.

DROP TRIGGER IF EXISTS user_profiles_socials_no_contact_info ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_socials_no_contact_info();

CREATE OR REPLACE FUNCTION public.enforce_socials_no_contact_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
  v_digits text;
BEGIN
  -- Admin bypass (moderation/support).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  FOREACH v IN ARRAY ARRAY[NEW.instagram, NEW.facebook, NEW.tiktok, NEW.snapchat]
  LOOP
    IF v IS NULL OR length(trim(v)) = 0 THEN
      CONTINUE;
    END IF;

    -- Block emails
    IF v ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' THEN
      RAISE EXCEPTION 'Please use social usernames only (no emails).';
    END IF;

    -- Block WhatsApp / Telegram / links
    IF v ILIKE '%whatsapp%'
      OR v ILIKE '%wa.me%'
      OR v ILIKE '%telegram%'
      OR v ILIKE '%t.me%'
      OR v ILIKE '%tg://%'
      OR v ILIKE '%mailto:%'
      OR v ILIKE '%http://%'
      OR v ILIKE '%https://%'
      OR v ILIKE '%www.%'
    THEN
      RAISE EXCEPTION 'Please use social usernames only (no WhatsApp/Telegram/links).';
    END IF;

    -- Block phone numbers (heuristic)
    v_digits := regexp_replace(v, '\D', '', 'g');
    IF length(v_digits) >= 10 OR (length(v_digits) >= 8 AND v ~ '[+\-() ]') THEN
      RAISE EXCEPTION 'Please use social usernames only (no phone numbers).';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_socials_no_contact_info
  BEFORE INSERT OR UPDATE OF instagram, facebook, tiktok, snapchat ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_socials_no_contact_info();

