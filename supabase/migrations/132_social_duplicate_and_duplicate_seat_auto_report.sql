-- 1) Block sign-up/onboarding when a social handle is already used by another user.
-- 2) Detect duplicate ticket seats (same show + day + city + section + row + seat)
--    and auto-report all involved listings to admins. Section/row/seat: treat
--    "standing floor", "GA", "general admission", "pelouse", "standing" as the same.

-- =============================================================================
-- 1) Social handle uniqueness (another user already has this handle)
-- =============================================================================
DROP TRIGGER IF EXISTS user_profiles_social_handle_unique ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_social_handle_unique();

CREATE OR REPLACE FUNCTION public.enforce_social_handle_unique()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_norm text;
  v_platform text;
  v_value text;
BEGIN
  FOREACH v_platform IN ARRAY ARRAY['instagram', 'facebook', 'tiktok', 'snapchat']
  LOOP
    v_value := CASE v_platform
      WHEN 'instagram' THEN NEW.instagram
      WHEN 'facebook' THEN NEW.facebook
      WHEN 'tiktok' THEN NEW.tiktok
      WHEN 'snapchat' THEN NEW.snapchat
    END;
    IF v_value IS NOT NULL AND trim(v_value) <> '' THEN
      v_norm := public.normalize_social_handle(v_platform, v_value);
      IF v_norm IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id IS DISTINCT FROM NEW.id
            AND (
              (v_platform = 'instagram' AND public.normalize_social_handle('instagram', up.instagram) = v_norm)
              OR (v_platform = 'facebook' AND public.normalize_social_handle('facebook', up.facebook) = v_norm)
              OR (v_platform = 'tiktok' AND public.normalize_social_handle('tiktok', up.tiktok) = v_norm)
              OR (v_platform = 'snapchat' AND public.normalize_social_handle('snapchat', up.snapchat) = v_norm)
            )
        ) THEN
          RAISE EXCEPTION 'This social already exists.';
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_social_handle_unique
  BEFORE INSERT OR UPDATE OF instagram, facebook, tiktok, snapchat ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_social_handle_unique();

-- =============================================================================
-- 2) Duplicate seat: normalize section/row/seat (GA, standing floor, general admission, pelouse, standing = same)
-- =============================================================================
DROP FUNCTION IF EXISTS public.normalize_seat_field(text);
CREATE OR REPLACE FUNCTION public.normalize_seat_field(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(p_value, ''))) IN ('standing floor', 'ga', 'general admission', 'pelouse', 'standing') THEN 'ga'
    ELSE lower(trim(coalesce(p_value, '')))
  END;
$$;

-- =============================================================================
-- 3) System report (reporter_id NULL) – bypass RLS
-- =============================================================================
DROP FUNCTION IF EXISTS public.insert_listing_report_system(uuid, text);
CREATE OR REPLACE FUNCTION public.insert_listing_report_system(p_listing_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.listing_reports (listing_id, reporter_id, reason)
  VALUES (p_listing_id, NULL, p_reason);
END;
$$;

-- =============================================================================
-- 4) After inserting or updating a listing_seat, find duplicate seats and auto-report all involved listings
-- =============================================================================
DROP TRIGGER IF EXISTS listing_seats_check_duplicate_seat ON public.listing_seats;
DROP FUNCTION IF EXISTS public.listing_seats_duplicate_seat_trigger();

CREATE OR REPLACE FUNCTION public.listing_seats_duplicate_seat_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text;
  v_date date;
  v_norm_section text;
  v_norm_row text;
  v_norm_seat text;
  v_listing_ids uuid[];
  v_lid uuid;
BEGIN
  SELECT l.concert_city, l.concert_date
  INTO v_city, v_date
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  IF v_city IS NULL OR v_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_norm_section := public.normalize_seat_field(NEW.section);
  v_norm_row     := public.normalize_seat_field(NEW.seat_row);
  v_norm_seat    := public.normalize_seat_field(NEW.seat);

  -- All listing_ids that have at least one seat with same (city, date, normalized section, row, seat)
  SELECT array_agg(DISTINCT l.id)
  INTO v_listing_ids
  FROM public.listings l
  JOIN public.listing_seats s ON s.listing_id = l.id
  WHERE l.concert_city = v_city
    AND l.concert_date = v_date
    AND public.normalize_seat_field(s.section) = v_norm_section
    AND public.normalize_seat_field(s.seat_row) = v_norm_row
    AND public.normalize_seat_field(s.seat) = v_norm_seat;

  -- Only auto-report when at least 2 listings share this seat
  IF v_listing_ids IS NOT NULL AND array_length(v_listing_ids, 1) >= 2 THEN
    FOREACH v_lid IN ARRAY v_listing_ids
    LOOP
      PERFORM public.insert_listing_report_system(v_lid, 'Reported by the system: duplicate seats (same show, date, city, and seat location).');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_seats_check_duplicate_seat
  AFTER INSERT OR UPDATE OF section, seat_row, seat ON public.listing_seats
  FOR EACH ROW EXECUTE FUNCTION public.listing_seats_duplicate_seat_trigger();
