-- Push notifications (Web Push / FCM): tokens, per-type preferences, listing alert preferences.
-- listing_alert_sent prevents duplicate "new listing matching your criteria" push per user.

-- 1) FCM/push tokens per user (one device can have one token; user can have multiple devices)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON public.push_tokens;
CREATE POLICY "push_tokens_select_own"
  ON public.push_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_insert_own" ON public.push_tokens;
CREATE POLICY "push_tokens_insert_own"
  ON public.push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_delete_own" ON public.push_tokens;
CREATE POLICY "push_tokens_delete_own"
  ON public.push_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2) Which notification types the user wants as push (JSONB: { "connection_request_received": true, ... })
-- One row per user; upsert by user_id.
CREATE TABLE IF NOT EXISTS public.notification_push_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_push_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_push_preferences_select_own" ON public.notification_push_preferences;
CREATE POLICY "notification_push_preferences_select_own"
  ON public.notification_push_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_push_preferences_insert_own" ON public.notification_push_preferences;
CREATE POLICY "notification_push_preferences_insert_own"
  ON public.notification_push_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_push_preferences_update_own" ON public.notification_push_preferences;
CREATE POLICY "notification_push_preferences_update_own"
  ON public.notification_push_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 3) Listing alert: notify when a listing matching filters is added or became available.
-- One row per user. Nullable filters = "any" for that dimension.
CREATE TABLE IF NOT EXISTS public.listing_alert_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  continent text,
  city text,
  listing_type text CHECK (listing_type IS NULL OR listing_type IN ('standard', 'vip', 'loge', 'suite')),
  concert_date date,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_alert_preferences_select_own" ON public.listing_alert_preferences;
CREATE POLICY "listing_alert_preferences_select_own"
  ON public.listing_alert_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "listing_alert_preferences_insert_own" ON public.listing_alert_preferences;
CREATE POLICY "listing_alert_preferences_insert_own"
  ON public.listing_alert_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "listing_alert_preferences_update_own" ON public.listing_alert_preferences;
CREATE POLICY "listing_alert_preferences_update_own"
  ON public.listing_alert_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 4) Track which users we already sent a "listing alert" push for which listing (avoid duplicates)
CREATE TABLE IF NOT EXISTS public.listing_alert_sent (
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_alert_sent_listing_id ON public.listing_alert_sent(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_alert_sent_user_id ON public.listing_alert_sent(user_id);

ALTER TABLE public.listing_alert_sent ENABLE ROW LEVEL SECURITY;

-- Only service role / backend inserts; users don't need to read this
DROP POLICY IF EXISTS "listing_alert_sent_select_own" ON public.listing_alert_sent;
CREATE POLICY "listing_alert_sent_select_own"
  ON public.listing_alert_sent FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5) user_notifications: add push_sent so we know which we already sent via FCM
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_notifications.push_sent IS 'True after push notification (FCM) was sent for this row.';
