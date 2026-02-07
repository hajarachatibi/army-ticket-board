"use client";

/**
 * Web Push (no Firebase): use the browser's Push API to subscribe and get a subscription object.
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY (VAPID public key, from e.g. npx web-push generate-vapid-keys).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type RequestPushResult =
  | { subscription: PushSubscriptionPayload; reason: "ok" }
  | { subscription: null; reason: "unsupported" }
  | { subscription: null; reason: "no_config" }
  | { subscription: null; reason: "denied" }
  | { subscription: null; reason: "error"; message?: string };

/** Decode base64url to Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

/** Request notification permission and subscribe to push. Returns subscription for registering with backend. */
export async function requestNotificationPermissionAndSubscribe(): Promise<RequestPushResult> {
  if (typeof window === "undefined") return { subscription: null, reason: "unsupported" };
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { subscription: null, reason: "unsupported" };
    }
    if (!VAPID_PUBLIC_KEY) return { subscription: null, reason: "no_config" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { subscription: null, reason: "denied" };

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await registration.update();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });

    const endpoint = subscription.endpoint;
    const p256dh = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");
    if (!p256dh || !auth) return { subscription: null, reason: "error", message: "Missing subscription keys" };

    const toBase64Url = (buf: ArrayBuffer): string => {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    };

    const payload: PushSubscriptionPayload = {
      endpoint,
      keys: { p256dh: toBase64Url(p256dh), auth: toBase64Url(auth) },
    };
    return { subscription: payload, reason: "ok" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { subscription: null, reason: "error", message: message || "Unknown error" };
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}
