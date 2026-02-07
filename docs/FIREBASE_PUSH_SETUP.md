# Firebase & Web Push setup

This app uses **Firebase Cloud Messaging (FCM)** for web push notifications. You need a Firebase project and these environment variables.

## 1. Create or use a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a project or select an existing one.
3. Add a **Web app** (</> icon) if you haven’t already. You’ll get config like `apiKey`, `authDomain`, `projectId`, etc.

## 2. Get the Web config (client)

In Firebase Console:

- **Project Settings** (gear) → **General** → scroll to **Your apps** → select your Web app.
- Copy the config values into your env (see list below).

## 3. Get the VAPID key (Web Push)

The **VAPID key** is required for the browser to request a push token.

1. In Firebase Console go to **Project Settings** (gear).
2. Open the **Cloud Messaging** tab.
3. Scroll to **Web configuration**.
4. Open the **Web Push certificates** tab.
5. If there’s no key yet, click **Generate key pair**. Copy the **Key pair** value (long string starting with something like `B...`).  
   If a key already exists, copy that one.

Put it in `.env.local` as:

```bash
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_key_here
```

No quotes; the value is the single long string.

## 4. Environment variables summary

**Client (browser) – all `NEXT_PUBLIC_` so they’re safe in the client bundle:**

| Variable | Where in Firebase |
|----------|-------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Project Settings → General → Your apps → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Same |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Same |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Same |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Same (often labeled “messagingSenderId”) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Same |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Project Settings → **Cloud Messaging** → Web Push certificates (generate key pair if needed) |

**Server (sending push from API):**

| Variable | Where in Firebase |
|----------|-------------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Project Settings → **Service accounts** → **Generate new private key** (paste the whole JSON as a single-line string), or use `GOOGLE_APPLICATION_CREDENTIALS` with a path to the JSON file. |

After changing env vars, restart the dev server (`npm run dev`).
