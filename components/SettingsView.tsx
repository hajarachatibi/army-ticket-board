"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/AuthContext";
import { ARIRANG_CITIES, ARIRANG_CONTINENTS } from "@/lib/data/arirang";
import { requestNotificationPermissionAndGetToken, isPushSupported } from "@/lib/firebase";
import { requestNotificationPermissionAndSubscribe } from "@/lib/webPush";
import {
  getListingAlertPreferences,
  getNotificationPreferences,
  registerPushSubscription,
  registerPushToken,
  updateListingAlertPreferences,
  updateNotificationPreferences,
  type ListingAlertPreferences,
  type NotificationPushPreferences,
} from "@/lib/supabase/pushNotifications";
import { fetchProfile } from "@/lib/data/user_profiles";
import { validateAllSocials } from "@/lib/security/socialValidation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/lib/ThemeContext";

// Bonding, preview, comfort are no longer sent (steps merged); kept in DB/context for old notifications.
const PUSH_NOTIFICATION_TYPES = [
  "connection_request_received",
  "connection_request_accepted",
  "connection_request_declined",
  "connection_on_waiting_list",
  "connection_social_updated",
  "connection_agreement_updated",
  "connection_match_confirmed",
  "connection_ended",
  "connection_undid_end",
  "connection_expired",
  "listing_removed_3_reports",
  "listing_removed_by_admin",
  "story_published",
  "story_admin_replied",
] as const;

const PUSH_TYPE_LABELS: Record<string, string> = {
  connection_request_received: "Connection request received",
  connection_request_accepted: "Connection request accepted",
  connection_request_declined: "Connection request declined",
  connection_on_waiting_list: "On waiting list",
  connection_social_updated: "Social share updated",
  connection_agreement_updated: "Agreement updated",
  connection_match_confirmed: "Match confirmed",
  connection_ended: "Connection ended",
  connection_undid_end: "Connection restored (undo)",
  connection_expired: "Connection expired",
  listing_removed_3_reports: "Listing removed (reports)",
  listing_removed_by_admin: "Listing removed by admin",
  story_published: "Story published",
  story_admin_replied: "Story admin reply",
};

export default function SettingsView() {
  const { user, isAdmin } = useAuth();
  const { dark, toggle } = useTheme();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string; needsSocialMigration?: boolean } | null>(null);

  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [socialsSaving, setSocialsSaving] = useState(false);
  const [socialsError, setSocialsError] = useState<string | null>(null);
  const [socialsSaved, setSocialsSaved] = useState<string | null>(null);

  // Notifications (push + listing alerts)
  const [pushPrefsLoading, setPushPrefsLoading] = useState(true);
  const [pushPrefs, setPushPrefs] = useState<NotificationPushPreferences>({});
  const [pushPrefsError, setPushPrefsError] = useState<string | null>(null);
  const [pushPrefsSaving, setPushPrefsSaving] = useState(false);
  const [enablePushLoading, setEnablePushLoading] = useState(false);
  const [enablePushMessage, setEnablePushMessage] = useState<string | null>(null);
  const [listingAlertLoading, setListingAlertLoading] = useState(true);
  const [listingAlertPrefs, setListingAlertPrefs] = useState<ListingAlertPreferences>({
    continent: null,
    city: null,
    listingType: null,
    concertDate: null,
    enabled: false,
  });
  const [listingAlertError, setListingAlertError] = useState<string | null>(null);
  const [listingAlertSaving, setListingAlertSaving] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosAddToHomeScreen, setShowIosAddToHomeScreen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await fetchProfile(user.id);
    setProfileLoading(false);
    if (error) {
      setProfileError(error);
      setProfile({ username: user.username });
      return;
    }
    if (data) {
      const hasOnlySnapOrTiktok =
        (Boolean(data.tiktok) || Boolean(data.snapchat)) && !data.instagram && !data.facebook;
      setProfile({ username: data.username, needsSocialMigration: hasOnlySnapOrTiktok });
      setInstagram(String(data.instagram ?? ""));
      setFacebook(String(data.facebook ?? ""));
    } else {
      setProfile({ username: user.username });
    }
  }, [user?.id, user?.username, user?.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveSocials = useCallback(async () => {
    if (!user?.id) return;
    setSocialsSaving(true);
    setSocialsError(null);
    setSocialsSaved(null);

    const validation = validateAllSocials({ instagram, facebook });
    if (validation) {
      setSocialsSaving(false);
      setSocialsError(validation);
      return;
    }

    const payload = {
      instagram: instagram.trim() ? instagram.trim() : null,
      facebook: facebook.trim() ? facebook.trim() : null,
      tiktok: null,
      snapchat: null,
    };
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", user.id);
    setSocialsSaving(false);
    if (error) {
      const msg = String(error.message ?? "");
      if (msg.toLowerCase().includes("social usernames only") || msg.toLowerCase().includes("no whatsapp") || msg.toLowerCase().includes("no phone")) {
        setSocialsError("Please use social usernames only (no phone numbers, emails, WhatsApp, Telegram).");
      } else {
        setSocialsError(msg);
      }
      return;
    }
    setSocialsSaved("Saved.");
    void loadProfile();
  }, [facebook, instagram, user?.id]);

  const loadPushPrefs = useCallback(async () => {
    if (!user?.id) return;
    setPushPrefsLoading(true);
    setPushPrefsError(null);
    const { data, error } = await getNotificationPreferences();
    setPushPrefsLoading(false);
    if (error) setPushPrefsError(error);
    else if (data) setPushPrefs(data);
  }, [user?.id]);

  const loadListingAlertPrefs = useCallback(async () => {
    if (!user?.id) return;
    setListingAlertLoading(true);
    setListingAlertError(null);
    const { data, error } = await getListingAlertPreferences();
    setListingAlertLoading(false);
    if (error) setListingAlertError(error);
    else if (data) setListingAlertPrefs(data);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadPushPrefs();
      void loadListingAlertPrefs();
    } else {
      setPushPrefsLoading(false);
      setListingAlertLoading(false);
    }
  }, [user?.id, loadPushPrefs, loadListingAlertPrefs]);

  const pushAlreadyActivatedMessage =
    "You've already activated notifications for this device. No need to do it again.";

  const handleEnablePush = useCallback(async () => {
    setEnablePushMessage(null);
    setEnablePushLoading(true);
    try {
      // 1) Try Firebase (FCM) first
      const result = await requestNotificationPermissionAndGetToken();
      if (result.reason === "ok" && result.token) {
        const { error } = await registerPushToken(result.token);
        if (error) {
          const isAlreadyActivated =
            /row level security|violates|duplicate|already exists|unique constraint/i.test(error);
          setEnablePushMessage(isAlreadyActivated ? pushAlreadyActivatedMessage : error);
          return;
        }
        setEnablePushMessage("Push notifications enabled (this device is registered).");
        return;
      }
      if (result.reason === "denied") {
        setEnablePushMessage(
          "Notifications were blocked. To enable them, open your browser or device settings for this site and allow notifications, then try again."
        );
        return;
      }
      if (result.reason === "unsupported") {
        setEnablePushMessage(
          "Push is not supported in this browser or context. On iPhone/iPad, add this site to your Home Screen and open the app from there, then try again."
        );
        return;
      }
      // 2) FCM failed (no_config or error) — try Web Push fallback so we still save this device
      const webResult = await requestNotificationPermissionAndSubscribe();
      if (webResult.reason === "ok" && webResult.subscription) {
        const { error } = await registerPushSubscription(webResult.subscription);
        if (error) {
          const isAlreadyActivated =
            /row level security|violates|duplicate|already exists|unique constraint/i.test(error);
          setEnablePushMessage(isAlreadyActivated ? pushAlreadyActivatedMessage : error);
          return;
        }
        setEnablePushMessage(
          "Push notifications enabled (Web Push). This device is registered. If Firebase is later configured, you can tap Allow again to also register for FCM."
        );
        return;
      }
      if (webResult.reason === "denied") {
        setEnablePushMessage(
          "Notifications were blocked. Open your browser or device settings for this site and allow notifications, then try again."
        );
        return;
      }
      if (webResult.reason === "no_config") {
        setEnablePushMessage(
          "Push is not configured: set Firebase (see docs/FIREBASE_PUSH_SETUP.md) or Web Push (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY) so this device can be registered."
        );
        return;
      }
      setEnablePushMessage(
        webResult.reason === "error" && webResult.message
          ? webResult.message
          : "Could not register this device for push. Try again or check app configuration."
      );
    } finally {
      setEnablePushLoading(false);
    }
  }, []);

  const setPushTypeEnabled = useCallback((type: string, enabled: boolean) => {
    setPushPrefs((prev) => ({ ...prev, [type]: enabled }));
  }, []);

  const savePushPrefs = useCallback(async () => {
    if (!user?.id) return;
    setPushPrefsSaving(true);
    setPushPrefsError(null);
    const { error } = await updateNotificationPreferences(pushPrefs);
    setPushPrefsSaving(false);
    if (error) setPushPrefsError(error);
  }, [user?.id, pushPrefs]);

  const saveListingAlertPrefs = useCallback(async () => {
    if (!user?.id) return;
    setListingAlertSaving(true);
    setListingAlertError(null);
    const { error } = await updateListingAlertPreferences(listingAlertPrefs);
    setListingAlertSaving(false);
    if (error) setListingAlertError(error);
  }, [user?.id, listingAlertPrefs]);

  const LISTING_TYPES = [
    { value: "", label: "Any" },
    { value: "standard", label: "Standard" },
    { value: "vip", label: "VIP" },
    { value: "loge", label: "Loge" },
    { value: "suite", label: "Suite" },
  ] as const;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-army-purple">Settings</h1>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Account</h2>
        {profileError && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{profileError}</p>
        )}
        {profileLoading ? (
          <p className="mt-4 text-neutral-500 dark:text-neutral-400">Loading profile…</p>
        ) : profile ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-semibold text-army-purple">Username</p>
            <p className="text-neutral-700 dark:text-neutral-300">{profile.username}</p>
            <p className="mt-2 text-sm font-semibold text-army-purple">Email</p>
            <p className="text-neutral-700 dark:text-neutral-300">{user?.email ?? ""}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Socials</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          There is no in-app buyer/seller chat. Please put the social you want ARMY to contact you on (Instagram or Facebook only). Use usernames only—no links, phone numbers, or emails.
        </p>
        {profile?.needsSocialMigration && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            We now support only <strong>Instagram</strong> and <strong>Facebook</strong> for contact. You previously had only TikTok or Snapchat. Please add Instagram or Facebook below so buyers can reach you.
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-army-purple">Instagram</label>
            <input className="input-army mt-2" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@username" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-army-purple">Facebook</label>
            <input className="input-army mt-2" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="username" />
          </div>
        </div>

        {socialsError && (
          <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {socialsError}
          </p>
        )}
        {socialsSaved && !socialsError && (
          <p className="mt-4 rounded-lg border border-army-purple/15 bg-army-purple/5 px-3 py-2 text-sm text-army-purple dark:border-army-purple/25 dark:bg-army-purple/10">
            {socialsSaved}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-army" onClick={saveSocials} disabled={socialsSaving || !user?.id}>
            {socialsSaving ? "Saving…" : "Save socials"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Appearance</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Dark / Light mode
          </span>
          <button
            type="button"
            onClick={toggle}
            className={`relative h-8 w-14 cursor-pointer rounded-full transition-colors ${
              dark ? "bg-army-purple" : "bg-army-purple/30"
            }`}
            aria-pressed={dark}
            aria-label="Toggle dark mode"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                dark ? "left-7" : "left-1"
              }`}
            />
          </button>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {dark ? "Dark" : "Light"}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-army-purple/15 bg-white p-6 dark:border-army-purple/25 dark:bg-neutral-900">
        <h2 className="font-display text-lg font-bold text-army-purple">Notifications</h2>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <p className="font-semibold">Important</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Allow notifications for this site in your browser to receive push notifications.</li>
            <li>On iOS: add this site to your Home Screen (Add to Home Screen) for push to work.</li>
            <li>Delivery is not 100% guaranteed; your device or OS may suppress or delay notifications.</li>
          </ul>
        </div>

        {isPushSupported() && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                Click below to open your browser’s &quot;Allow notifications&quot; dialog, then we’ll save this device for push.
              </p>
              <button
                type="button"
                className="btn-army"
                onClick={handleEnablePush}
                disabled={enablePushLoading}
              >
                {enablePushLoading ? "Opening…" : "Allow notifications"}
              </button>
              {enablePushMessage && (
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{enablePushMessage}</p>
              )}
            </div>
            {isIos && (
              <div>
                <button
                  type="button"
                  className="btn-army-outline"
                  onClick={() => setShowIosAddToHomeScreen((v) => !v)}
                >
                  {showIosAddToHomeScreen ? "Hide iOS steps" : "How to add to Home Screen (iOS)"}
                </button>
                {showIosAddToHomeScreen && (
                  <div className="mt-3 rounded-lg border border-army-purple/20 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:text-neutral-300">
                    <p className="font-semibold text-army-purple">Add this site to your Home Screen for push on iOS:</p>
                    <ol className="mt-2 list-inside list-decimal space-y-1">
                      <li>Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari.</li>
                      <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong> in the top right.</li>
                    </ol>
                    <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                      Then open the app from your Home Screen and allow notifications when prompted.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isPushSupported() && (
          <div className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p>Push notifications are not supported in this browser or context.</p>
            {isIos && (
              <>
                <p>
                  <strong>On iPhone/iPad:</strong> Safari only supports push when the site is <strong>added to your Home Screen</strong> and you open the app from there (not from a normal Safari tab). Add to Home Screen using the steps below, then open the app from your home screen and return to Settings to enable notifications.
                </p>
                <div>
                  <button
                    type="button"
                    className="btn-army-outline"
                    onClick={() => setShowIosAddToHomeScreen((v) => !v)}
                  >
                    {showIosAddToHomeScreen ? "Hide steps" : "How to add to Home Screen (iOS)"}
                  </button>
                  {showIosAddToHomeScreen && (
                    <div className="mt-3 rounded-lg border border-army-purple/20 bg-army-purple/5 p-4 text-sm text-neutral-700 dark:text-neutral-300">
                      <ol className="list-inside list-decimal space-y-1">
                        <li>Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari.</li>
                        <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
                        <li>Tap <strong>Add</strong> in the top right.</li>
                      </ol>
                      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                        Then open the app from your Home Screen and allow notifications when prompted.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-display text-base font-semibold text-army-purple">Notification types</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Choose which events trigger a push notification.
          </p>
          {pushPrefsError && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{pushPrefsError}</p>
          )}
          {pushPrefsLoading ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : (
            <div className="mt-4 space-y-3">
              {PUSH_NOTIFICATION_TYPES.map((type) => (
                <div key={type} className="flex items-center justify-between gap-4">
                  <label className="text-sm text-neutral-700 dark:text-neutral-300" htmlFor={`push-${type}`}>
                    {PUSH_TYPE_LABELS[type] ?? type}
                  </label>
                  <button
                    id={`push-${type}`}
                    type="button"
                    role="switch"
                    aria-checked={Boolean(pushPrefs[type])}
                    className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                      pushPrefs[type] ? "bg-army-purple" : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                    onClick={() => setPushTypeEnabled(type, !pushPrefs[type])}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        pushPrefs[type] ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
          {!pushPrefsLoading && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="btn-army"
                onClick={savePushPrefs}
                disabled={pushPrefsSaving || !user?.id}
              >
                {pushPrefsSaving ? "Saving…" : "Save notification types"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-army-purple/15 pt-6 dark:border-army-purple/25">
          <h3 className="font-display text-base font-semibold text-army-purple">Listing alerts</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Get a push when a new or newly available listing matches your criteria.
          </p>
          {listingAlertError && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{listingAlertError}</p>
          )}
          {listingAlertLoading ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Enable listing alerts
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={listingAlertPrefs.enabled}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                    listingAlertPrefs.enabled ? "bg-army-purple" : "bg-neutral-300 dark:bg-neutral-600"
                  }`}
                  onClick={() =>
                    setListingAlertPrefs((p) => ({ ...p, enabled: !p.enabled }))
                  }
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      listingAlertPrefs.enabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Continent</label>
                  <select
                    className="input-army mt-2"
                    value={listingAlertPrefs.continent ?? ""}
                    onChange={(e) =>
                      setListingAlertPrefs((p) => ({
                        ...p,
                        continent: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">Any</option>
                    {ARIRANG_CONTINENTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">City</label>
                  <select
                    className="input-army mt-2"
                    value={listingAlertPrefs.city ?? ""}
                    onChange={(e) =>
                      setListingAlertPrefs((p) => ({
                        ...p,
                        city: e.target.value || null,
                      }))
                    }
                  >
                    <option value="">Any</option>
                    {ARIRANG_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Type</label>
                  <select
                    className="input-army mt-2"
                    value={listingAlertPrefs.listingType ?? ""}
                    onChange={(e) =>
                      setListingAlertPrefs((p) => ({
                        ...p,
                        listingType: (e.target.value || null) as ListingAlertPreferences["listingType"],
                      }))
                    }
                  >
                    {LISTING_TYPES.map(({ value, label }) => (
                      <option key={value || "any"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-army-purple">Concert date</label>
                  <input
                    type="date"
                    className="input-army mt-2"
                    value={listingAlertPrefs.concertDate ?? ""}
                    onChange={(e) =>
                      setListingAlertPrefs((p) => ({
                        ...p,
                        concertDate: e.target.value || null,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-army"
                  onClick={saveListingAlertPrefs}
                  disabled={listingAlertSaving || !user?.id}
                >
                  {listingAlertSaving ? "Saving…" : "Save listing alerts"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
