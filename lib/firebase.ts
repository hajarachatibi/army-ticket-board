"use client";

import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getOrInitApp() {
  if (typeof window === "undefined") return null;
  const apps = getApps();
  if (apps.length > 0) return apps[0];
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    return null;
  }
  return initializeApp(firebaseConfig);
}

let messagingInstance: Messaging | null = null;

export function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  const app = getOrInitApp();
  if (!app) return null;
  if (!messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch {
      messagingInstance = null;
    }
  }
  return messagingInstance;
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export type RequestPushResult =
  | { token: string; reason: "ok" }
  | { token: null; reason: "unsupported" }
  | { token: null; reason: "no_config" }
  | { token: null; reason: "denied" }
  | { token: null; reason: "error"; message?: string };

/** Request notification permission and get FCM token. Returns result with reason for UI messaging. */
export async function requestNotificationPermissionAndGetToken(): Promise<RequestPushResult> {
  if (typeof window === "undefined") return { token: null, reason: "unsupported" };
  try {
    const supported = await isSupported();
    if (!supported) return { token: null, reason: "unsupported" };
    const app = getOrInitApp();
    if (!app || !VAPID_KEY) return { token: null, reason: "no_config" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { token: null, reason: "denied" };
    }
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await registration.update();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) return { token, reason: "ok" };
    return { token: null, reason: "error", message: "No token from browser" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { token: null, reason: "error", message: message || "Unknown error" };
  }
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}
