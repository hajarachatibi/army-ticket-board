-- One-off: keep only one FCM token and one Web Push subscription per user (the most recent).
-- Removes duplicates that cause double notifications. New registrations already enforce one-per-user in app code.

WITH keep_tokens AS (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC NULLS LAST) AS rn
    FROM public.push_tokens
  ) sub
  WHERE sub.rn = 1
)
DELETE FROM public.push_tokens
WHERE id NOT IN (SELECT id FROM keep_tokens);

WITH keep_subs AS (
  SELECT id
  FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC NULLS LAST) AS rn
    FROM public.push_subscriptions
  ) sub
  WHERE sub.rn = 1
)
DELETE FROM public.push_subscriptions
WHERE id NOT IN (SELECT id FROM keep_subs);
