/**
 * Server-side Web Push send. Uses the web-push library with VAPID keys.
 * Requires VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (generate with: npx web-push generate-vapid-keys).
 */

import webpush from "web-push";

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const mailto = process.env.VAPID_MAILTO ?? "mailto:support@example.com";
const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  if (publicKey && privateKey) {
    webpush.setVapidDetails(mailto, publicKey, privateKey);
    vapidSet = true;
  }
}

export function isWebPushConfigured(): boolean {
  return !!(publicKey && privateKey);
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; data?: Record<string, string> }
): Promise<{ success: boolean; error?: string }> {
  ensureVapid();
  if (!isWebPushConfigured()) return { success: false, error: "Web Push not configured" };
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    ...payload.data,
  });
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      body
    );
    return { success: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    // 404/410 = subscription expired or invalid
    if (err.statusCode === 404 || err.statusCode === 410) {
      return { success: false, error: "invalid_subscription" };
    }
    return { success: false, error: err.message ?? String(e) };
  }
}
