import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

export const runtime = "nodejs";

/**
 * Admin-only: return counts to diagnose why push/listing alerts might send 0.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const service = createServiceClient();
  const pushCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [
    { count: pendingNotifications },
    { data: tokensRows },
    { data: subsRows },
    { count: enabledListingAlerts },
    { data: listingsRaw },
  ] = await Promise.all([
    service.from("user_notifications").select("id", { count: "exact", head: true }).eq("push_sent", false).gte("created_at", pushCutoff),
    service.from("push_tokens").select("user_id"),
    service.from("push_subscriptions").select("user_id"),
    service.from("listing_alert_preferences").select("user_id", { count: "exact", head: true }).eq("enabled", true),
    service
      .from("listings")
      .select("id, created_at, updated_at, processing_until")
      .in("status", ["processing", "active", "locked", "sold"])
      .neq("status", "removed"),
  ]);

  const listingsInWindow = (listingsRaw ?? []).filter((l) => {
    const createdRecent = (l.created_at ?? "") >= windowStart;
    const updatedRecent = (l.updated_at ?? "") >= windowStart;
    if (!createdRecent && !updatedRecent) return false;
    return !l.processing_until || l.processing_until <= now;
  }).length;

  const tokenUserIds = new Set((tokensRows ?? []).map((r) => r.user_id));
  const subsUserIds = new Set((subsRows ?? []).map((r) => r.user_id));
  const uniqueUsersWithTokens = new Set([...tokenUserIds, ...subsUserIds]).size;

  return NextResponse.json({
    pendingNotifications: pendingNotifications ?? 0,
    totalPushTokens: tokensRows?.length ?? 0,
    totalWebPushSubscriptions: subsRows?.length ?? 0,
    usersWithPushTokens: uniqueUsersWithTokens,
    enabledListingAlerts: enabledListingAlerts ?? 0,
    listingsInWindow,
  });
}
