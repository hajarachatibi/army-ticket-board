# Firebase push notifications – env vars and where to get them

This app uses **Firebase Cloud Messaging (FCM)** for web push. You need a Firebase project and these environment variables. Set every one below for push to work.

---

## 1. Firebase project and Web app

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a project (or use an existing one).
3. In the project, click the **</> (Web)** icon to add a Web app. Register the app (you can skip Firebase Hosting). You’ll see a config object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc...",
   };
   ```

4. Copy each value into `.env.local` as shown in the table below.

---

## 2. Env vars – client (browser)

All of these are required so the browser can initialize Firebase and request a push token. Get them from **Firebase Console → Project Settings (gear) → General → Your apps → your Web app**.

| Env variable | Where to get the value |
|--------------|------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | In the Web app config: **apiKey** |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | In the Web app config: **authDomain** (e.g. `your-project.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | In the Web app config: **projectId** |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | In the Web app config: **storageBucket** (e.g. `your-project.appspot.com`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | In the Web app config: **messagingSenderId** (numeric string) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | In the Web app config: **appId** (e.g. `1:123456789:web:abc...`) |

---

## 3. VAPID key (Web Push) – client

The browser uses this when subscribing for push. Get it from Firebase, not from `web-push`:

1. **Firebase Console** → **Project Settings** (gear).
2. Open the **Cloud Messaging** tab.
3. Scroll to **Web configuration**.
4. Open the **Web Push certificates** tab.
5. If there’s no key, click **Generate key pair**. Copy the **Key pair** (long string, often starting with `B...`).
6. Put it in `.env.local`:

| Env variable | Where to get the value |
|--------------|------------------------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | **Cloud Messaging** → **Web Push certificates** → Key pair (or “Generate key pair”) |

Use the **same** public key only (the one you expose to the client). The private key is not used in the browser.

---

## 4. Server (sending push from your API)

The cron job that sends push notifications uses the Firebase Admin SDK. It needs **service account** credentials.

1. **Firebase Console** → **Project Settings** (gear) → **Service accounts**.
2. Click **Generate new private key** (or use an existing service account).
3. A JSON file downloads. You have two options:

**Option A – JSON in env (recommended for hosted apps)**

- Open the JSON file. It looks like: `{ "type": "service_account", "project_id": "...", "private_key_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\n...", "client_email": "...", ... }`.
- Put the **entire** JSON in a **single line** (no line breaks) and set:

| Env variable | Where to get the value |
|--------------|------------------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | The full contents of the downloaded service account JSON, as a single-line string. In `.env.local` you can use a single line; if your host supports multi-line secrets, you can paste the JSON with newlines and the code will parse it. |

**Option B – File path (e.g. local dev)**

- Save the JSON file somewhere (e.g. `./firebase-service-account.json`) and **do not** commit it.
- Set:

| Env variable | Where to get the value |
|--------------|------------------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute or relative path to that JSON file (e.g. `./firebase-service-account.json`) |

You need **either** `FIREBASE_SERVICE_ACCOUNT_JSON` **or** `GOOGLE_APPLICATION_CREDENTIALS`; the server uses whichever is set.

---

## 5. Web Push fallback (no Firebase)

If Firebase isn’t configured or the browser can’t get an FCM token (e.g. missing `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in production), the app will try **Web Push** when the user taps “Allow notifications” in Settings. For that to work:

1. Generate a VAPID key pair (once):  
   `npx web-push generate-vapid-keys`
2. Set in your env (and in Vercel):
   - **Client:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the **public** key (so the browser can subscribe).
   - **Server:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` = same public key and the **private** key (so the cron can send via the `web-push` library).

Push is then sent to both FCM tokens (if configured) and Web Push subscriptions. Admin **Cron & Push** stats show “FCM tokens” and “Web Push” counts; if “Users with push tokens” is 0, no device has registered yet (try “Allow notifications” again after setting the keys).

---

## 6. Summary checklist

Add these to `.env.local` (or your host’s env):

```bash
# --- Client (from Firebase Web app config) ---
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# --- Client (from Cloud Messaging → Web Push certificates) ---
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...

# --- Server (from Project Settings → Service accounts → Generate new private key) ---
# Either paste the whole JSON in one line:
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
# Or use a file path (e.g. local):
# GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

After changing env vars, restart the dev server (`npm run dev`).

---

## 7. Cron (required for push and listing alerts)

Push notifications and **listing alerts** are sent when the cron runs. The repo includes `vercel.json` so that **Vercel Cron** calls `/api/cron/process` every 15 minutes.

- Set **`CRON_SECRET`** in your Vercel project (**Project → Settings → Environment Variables**): a random string (e.g. 32 chars). When this variable is set, Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking the cron; the API rejects requests without it. **Use the Production (and Preview if needed) environment** so the cron runner can send it.
- Without `CRON_SECRET`, the cron endpoint returns 401 and automatic runs never succeed (manual run from Admin still works because it uses the same secret from your server env).
- **Vercel Hobby (free) plan:** Cron jobs can run **only once per day**. The schedule in `vercel.json` is every 15 minutes; that requires **Pro** (or Team/Enterprise). On Hobby, the automatic cron will not run every 15 min — use **Admin → Cron & Push → Run push & listing alerts now** when you need to send, or upgrade to Pro, or use an external cron service (e.g. cron-job.org) that calls `GET https://YOUR_DOMAIN/api/cron/process` with header `Authorization: Bearer YOUR_CRON_SECRET` every 15 minutes.
- Push is sent when **FCM** and/or **Web Push** is configured. If FCM is set, notifications go to FCM tokens; if `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set, they also go to Web Push subscriptions. If neither is set, the response includes a `reason` and push is skipped.

### How to check if cron / push is working

1. **Admin panel:** Sign in as an admin, go to **Admin → Cron & Push**. Click **Run push & listing alerts now**. The JSON result shows:
   - **`push`:** `{ "sent": N, "errors": M }` (notifications sent) or `"skipped"` with a **`reason`** if FCM isn’t configured.
   - **`listingAlerts`:** `{ "sent": N, "errors": M }` or `"skipped"`.
   - If you see a `reason` like “Neither FCM nor Web Push configured”, set either **FIREBASE_SERVICE_ACCOUNT_JSON** (and client Firebase env) or **VAPID_PUBLIC_KEY** + **VAPID_PRIVATE_KEY** + **NEXT_PUBLIC_VAPID_PUBLIC_KEY** and redeploy.
   - If you see `push: { sent: 0, errors: 0 }` and no pending notifications, the job ran but there was nothing to send.

2. **Manual request (optional):** From your machine, run (replace with your domain and secret):
   ```bash
   curl -X GET "https://YOUR_DOMAIN.vercel.app/api/cron/process" -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   The response includes `process_push` with the same structure as above. Vercel Cron uses GET to this URL on the schedule in `vercel.json` (e.g. every 15 minutes on Pro).

3. **Vercel logs:** In the Vercel dashboard, **Logs** or **Functions** may show cron invocations. If there are no errors but you still get no notifications, use the Admin **Cron & Push** tab to confirm the process-push result (e.g. FCM configured, tokens present, and prefs enabled).

---

## 8. iOS Safari

On **iPhone/iPad**, FCM web push only works when the site is **added to the Home Screen** and opened from there (not from a normal Safari tab). Users should use **Share → Add to Home Screen**, then open the app from the home screen and allow notifications.
