import { supabase } from "@/lib/supabaseClient";

export type NotificationPushPreferences = Record<string, boolean>;

export type ListingAlertPreferences = {
  continent: string | null;
  city: string | null;
  listingType: "standard" | "vip" | "loge" | "suite" | null;
  concertDate: string | null; // YYYY-MM-DD
  enabled: boolean;
};

/** Web Push subscription from the Push API (endpoint + keys). */
export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function registerPushToken(token: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("push_tokens")
    .upsert({ token, user_id: user.id }, { onConflict: "token" });
  if (error) return { error: error.message };
  return { error: null };
}

/** Register a Web Push subscription (no Firebase). */
export async function registerPushSubscription(
  subscription: PushSubscriptionPayload
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { error: error.message };
  return { error: null };
}

export async function getNotificationPreferences(): Promise<{
  data: NotificationPushPreferences | null;
  error: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not signed in" };
  const { data, error } = await supabase
    .from("notification_push_preferences")
    .select("preferences")
    .eq("user_id", user.id)
    .single();
  if (error && error.code !== "PGRST116") return { data: null, error: error.message };
  const prefs = (data?.preferences as NotificationPushPreferences) ?? {};
  return { data: prefs, error: null };
}

export async function updateNotificationPreferences(
  preferences: NotificationPushPreferences
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("notification_push_preferences")
    .upsert(
      { user_id: user.id, preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  return { error: error?.message ?? null };
}

export async function getListingAlertPreferences(): Promise<{
  data: ListingAlertPreferences | null;
  error: string | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not signed in" };
  const { data, error } = await supabase
    .from("listing_alert_preferences")
    .select("continent, city, listing_type, concert_date, enabled")
    .eq("user_id", user.id)
    .single();
  if (error && error.code !== "PGRST116") return { data: null, error: error.message };
  if (!data)
    return {
      data: {
        continent: null,
        city: null,
        listingType: null,
        concertDate: null,
        enabled: false,
      },
      error: null,
    };
  return {
    data: {
      continent: data.continent ?? null,
      city: data.city ?? null,
      listingType: data.listing_type ?? null,
      concertDate: data.concert_date ?? null,
      enabled: Boolean(data.enabled),
    },
    error: null,
  };
}

export async function updateListingAlertPreferences(
  prefs: Partial<ListingAlertPreferences>
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const row = {
    user_id: user.id,
    continent: prefs.continent ?? null,
    city: prefs.city ?? null,
    listing_type: prefs.listingType ?? null,
    concert_date: prefs.concertDate ?? null,
    enabled: prefs.enabled ?? false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("listing_alert_preferences")
    .upsert(row, { onConflict: "user_id" });
  return { error: error?.message ?? null };
}
