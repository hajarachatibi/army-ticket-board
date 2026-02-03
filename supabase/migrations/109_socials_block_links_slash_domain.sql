-- Block links in social fields: no slashes or domain-like TLDs (username only).

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
  v_lower text;
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

    v_lower := lower(trim(v));

    -- Block emails
    IF v ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' THEN
      RAISE EXCEPTION 'Please use social usernames only (no emails).';
    END IF;

    -- Block links: protocol, www, path separators, domain TLDs
    IF v_lower LIKE '%http://%' OR v_lower LIKE '%https://%' OR v_lower LIKE 'www.%' OR v_lower LIKE '%www.%'
      OR v_lower LIKE '%/%' OR position(E'\\' in v_lower) > 0
      OR v_lower LIKE '%.com%' OR v_lower LIKE '%.net%' OR v_lower LIKE '%.org%' OR v_lower LIKE '%.io%' OR v_lower LIKE '%.me/%' OR v_lower LIKE '%.co/%'
      OR v_lower LIKE '%whatsapp%' OR v_lower LIKE '%wa.me%'
      OR v_lower LIKE '%telegram%' OR v_lower LIKE '%t.me%' OR v_lower LIKE '%tg://%'
      OR v_lower LIKE '%mailto:%'
    THEN
      RAISE EXCEPTION 'Please use social usernames only (no links).';
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
