-- Normalize concert_city to canonical forms (e.g. LAS VEGAS -> Las Vegas) and restrict to allowed list.
-- Allowed list must match ARIRANG_CITIES in lib/data/arirang.ts.

DO $$
DECLARE
  v_allowed text[] := ARRAY[
    'Arlington', 'Bangkok', 'Baltimore', 'Bogotá', 'Brussels', 'Busan', 'Buenos Aires',
    'Chicago', 'East Rutherford', 'El Paso', 'Foxborough', 'Goyang', 'Hong Kong',
    'Jakarta', 'Kaohsiung', 'Kuala Lumpur', 'Las Vegas', 'Lima', 'London', 'Los Angeles',
    'Madrid', 'Manila', 'Melbourne', 'Mexico City', 'Munich', 'Paris', 'Santiago',
    'Singapore', 'São Paulo', 'Stanford', 'Sydney', 'Tampa', 'Tokyo', 'Toronto'
  ];
BEGIN
  -- 1) Normalize: set canonical city where trim/lower matches (e.g. LAS VEGAS -> Las Vegas).
  UPDATE public.listings
  SET concert_city = c.canonical
  FROM (VALUES
    ('arlington', 'Arlington'), ('bangkok', 'Bangkok'), ('baltimore', 'Baltimore'),
    ('bogotá', 'Bogotá'), ('brussels', 'Brussels'), ('busan', 'Busan'),
    ('buenos aires', 'Buenos Aires'), ('chicago', 'Chicago'),
    ('east rutherford', 'East Rutherford'), ('el paso', 'El Paso'),
    ('foxborough', 'Foxborough'), ('goyang', 'Goyang'), ('hong kong', 'Hong Kong'),
    ('jakarta', 'Jakarta'), ('kaohsiung', 'Kaohsiung'), ('kuala lumpur', 'Kuala Lumpur'),
    ('las vegas', 'Las Vegas'), ('lima', 'Lima'), ('london', 'London'),
    ('los angeles', 'Los Angeles'), ('madrid', 'Madrid'), ('manila', 'Manila'),
    ('melbourne', 'Melbourne'), ('mexico city', 'Mexico City'), ('munich', 'Munich'),
    ('paris', 'Paris'), ('santiago', 'Santiago'), ('singapore', 'Singapore'),
    ('são paulo', 'São Paulo'), ('stanford', 'Stanford'), ('sydney', 'Sydney'),
    ('tampa', 'Tampa'), ('tokyo', 'Tokyo'), ('toronto', 'Toronto')
  ) AS c(lower_name, canonical)
  WHERE lower(trim(concert_city)) = c.lower_name
    AND concert_city IS NOT NULL;

  -- 2) Fix any remaining invalid: set to first allowed city so constraint can be added.
  UPDATE public.listings
  SET concert_city = 'Las Vegas'
  WHERE concert_city IS NOT NULL
    AND concert_city <> ALL(v_allowed);

  -- 3) Add check constraint so only allowed cities can be stored (constant expression required).
  ALTER TABLE public.listings
    DROP CONSTRAINT IF EXISTS listings_concert_city_allowed;
END $$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_concert_city_allowed
  CHECK (concert_city = ANY(ARRAY[
    'Arlington', 'Bangkok', 'Baltimore', 'Bogotá', 'Brussels', 'Busan', 'Buenos Aires',
    'Chicago', 'East Rutherford', 'El Paso', 'Foxborough', 'Goyang', 'Hong Kong',
    'Jakarta', 'Kaohsiung', 'Kuala Lumpur', 'Las Vegas', 'Lima', 'London', 'Los Angeles',
    'Madrid', 'Manila', 'Melbourne', 'Mexico City', 'Munich', 'Paris', 'Santiago',
    'Singapore', 'São Paulo', 'Stanford', 'Sydney', 'Tampa', 'Tokyo', 'Toronto'
  ]::text[]));

COMMENT ON CONSTRAINT listings_concert_city_allowed ON public.listings IS 'Concert city must be one of the Arirang tour cities (see lib/data/arirang.ts).';
