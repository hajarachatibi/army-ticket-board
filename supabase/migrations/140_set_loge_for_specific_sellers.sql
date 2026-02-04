-- Set loge = true for all listings by these sellers (by email).
UPDATE public.listings
SET loge = true
WHERE seller_id IN (
  SELECT id FROM public.user_profiles
  WHERE email IN (
    'idalange@gmail.com',
    'katchu78@gmail.com'
  )
);
