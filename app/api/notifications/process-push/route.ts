import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { sendFcmToToken, isFcmConfigured } from "@/lib/fcm/send";
import { sendWebPush, isWebPushConfigured } from "@/lib/webPush/send";

export const runtime = "nodejs";
export const maxDuration = 60;

const FCM_OK = isFcmConfigured();
const WEB_PUSH_OK = isWebPushConfigured();

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!FCM_OK && !WEB_PUSH_OK) {
    return NextResponse.json({
      ok: true,
      push: "skipped",
      listingAlerts: "skipped",
      reason: "Neither FCM nor Web Push configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or VAPID_PUBLIC_KEY+VAPID_PRIVATE_KEY.",
    });
  }

  const supabase = createServiceClient();
  const results: { push?: { sent: number; errors: number }; listingAlerts?: { sent: number; errors: number } } = {};

  // Only push for notifications from the last 30 days so we don't flood users with old notifications after deploy
  const pushCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: notifications } = await supabase
    .from("user_notifications")
    .select("id, user_id, type, message, listing_id, listing_summary, connection_id")
    .eq("push_sent", false)
    .gte("created_at", pushCutoff)
    .limit(200);

  let pushSent = 0;
  let pushErrors = 0;

  if (notifications?.length) {
    const prefsMap = new Map<string, Record<string, boolean>>();
    const tokensMap = new Map<string, string[]>();
    const subsMap = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();

    for (const n of notifications) {
      const uid = n.user_id;
      if (!tokensMap.has(uid)) {
        const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", uid);
        tokensMap.set(uid, (tokens ?? []).map((r) => r.token));
      }
      if (!subsMap.has(uid)) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", uid);
        subsMap.set(
          uid,
          (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }))
        );
      }
      if (!prefsMap.has(uid)) {
        const { data: row } = await supabase
          .from("notification_push_preferences")
          .select("preferences")
          .eq("user_id", uid)
          .single();
        prefsMap.set(uid, (row?.preferences as Record<string, boolean>) ?? {});
      }
      const prefs = prefsMap.get(uid)!;
      const pushEnabled = prefs[n.type] !== false;
      if (!pushEnabled) {
        await supabase.from("user_notifications").update({ push_sent: true }).eq("id", n.id);
        continue;
      }
      const tokens = tokensMap.get(uid)!;
      const subs = subsMap.get(uid)!;
      const title = "ARMY Ticket Board";
      const body = n.message ?? n.listing_summary ?? "New notification";
      const data: Record<string, string> = { type: n.type };
      if (n.connection_id) data.connectionId = n.connection_id;
      if (n.listing_id) data.listingId = n.listing_id;

      for (const token of tokens) {
        if (!FCM_OK) continue;
        const r = await sendFcmToToken(token, { title, body, data });
        if (r.success) pushSent++;
        else {
          pushErrors++;
          if (r.error === "invalid_token") await supabase.from("push_tokens").delete().eq("token", token);
        }
      }
      for (const sub of subs) {
        if (!WEB_PUSH_OK) continue;
        const r = await sendWebPush(sub, { title, body, data });
        if (r.success) pushSent++;
        else {
          pushErrors++;
          if (r.error === "invalid_subscription") {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
      await supabase.from("user_notifications").update({ push_sent: true }).eq("id", n.id);
    }
  }
  results.push = { sent: pushSent, errors: pushErrors };

  const now = new Date().toISOString();
  // Consider listings created or updated in the last 24h so we don't miss alerts when cron runs less often
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: listingsRaw } = await supabase
    .from("listings")
    .select("id, concert_city, concert_date, vip, loge, suite, created_at, processing_until, updated_at")
    .in("status", ["processing", "active", "locked", "sold"])
    .neq("status", "removed");
  const listings = (listingsRaw ?? []).filter((l) => {
    const createdRecent = (l.created_at ?? "") >= windowStart;
    const updatedRecent = (l.updated_at ?? "") >= windowStart;
    if (!createdRecent && !updatedRecent) return false;
    const processingUntil = l.processing_until;
    return !processingUntil || processingUntil <= now;
  });

  let alertSent = 0;
  let alertErrors = 0;
  if (listings?.length) {
    const { data: alertPrefs } = await supabase.from("listing_alert_preferences").select("user_id, continent, city, listing_type, concert_date").eq("enabled", true);
    const { data: sentRows } = await supabase.from("listing_alert_sent").select("listing_id, user_id");
    const sentSet = new Set((sentRows ?? []).map((r) => `${r.listing_id}:${r.user_id}`));

    const { getContinentForCity } = await import("@/lib/data/arirang");
    for (const l of listings) {
      const listingContinent = getContinentForCity(l.concert_city ?? "");
      const listingType = l.suite ? "suite" : l.loge ? "loge" : l.vip ? "vip" : "standard";
      const listingDate = l.concert_date ?? "";

      for (const prefs of alertPrefs ?? []) {
        const key = `${l.id}:${prefs.user_id}`;
        if (sentSet.has(key)) continue;
        const matchContinent = !prefs.continent || prefs.continent === listingContinent;
        const matchCity = !prefs.city || prefs.city === l.concert_city;
        const matchType = !prefs.listing_type || prefs.listing_type === listingType;
        const matchDate = !prefs.concert_date || String(prefs.concert_date) === String(listingDate);
        if (!matchContinent || !matchCity || !matchType || !matchDate) continue;

        const title = "New listing matching your criteria";
        const body = `${l.concert_city ?? ""} · ${listingDate}`;
        const alertData = { type: "listing_alert", listingId: l.id };
        const { data: tokens } = await supabase.from("push_tokens").select("token").eq("user_id", prefs.user_id);
        for (const t of tokens ?? []) {
          if (!FCM_OK) continue;
          const r = await sendFcmToToken(t.token, { title, body, data: alertData });
          if (r.success) alertSent++;
          else {
            alertErrors++;
            if (r.error === "invalid_token") await supabase.from("push_tokens").delete().eq("token", t.token);
          }
        }
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", prefs.user_id);
        for (const sub of subs ?? []) {
          if (!WEB_PUSH_OK) continue;
          const r = await sendWebPush(sub, { title, body, data: alertData });
          if (r.success) alertSent++;
          else {
            alertErrors++;
            if (r.error === "invalid_subscription") {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
          }
        }
        await supabase.from("listing_alert_sent").insert({ listing_id: l.id, user_id: prefs.user_id });
        sentSet.add(key);
      }
    }
  }
  results.listingAlerts = { sent: alertSent, errors: alertErrors };

  return NextResponse.json({ ok: true, ...results });
}
