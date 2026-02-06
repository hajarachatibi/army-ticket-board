/**
 * Server-side FCM send. Requires FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) or
 * GOOGLE_APPLICATION_CREDENTIALS path to service account file.
 */

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";

function getAdminApp(): App | null {
  if (getApps().length > 0) return getApps()[0] as App;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const cred = JSON.parse(json);
      return initializeApp({ credential: cert(cred) });
    } catch {
      return null;
    }
  }
  try {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  } catch {
    return null;
  }
}

export async function sendFcmToToken(
  token: string,
  options: { title: string; body: string; data?: Record<string, string> }
): Promise<{ success: boolean; error?: string }> {
  const app = getAdminApp();
  if (!app) return { success: false, error: "FCM not configured" };
  const messaging = getMessaging(app);
  const message: Message = {
    token,
    notification: { title: options.title, body: options.body },
    data: options.data ?? {},
    webpush: {
      fcmOptions: { link: "/" },
    },
  };
  try {
    await messaging.send(message);
    return { success: true };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "messaging/invalid-registration-token" || err.code === "messaging/registration-token-not-registered") {
      return { success: false, error: "invalid_token" };
    }
    return { success: false, error: err.message ?? String(e) };
  }
}

export function isFcmConfigured(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}
