import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { rateLimitSigninByIp } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? process.env.MAINTENANCE_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseMaintenanceBypassEmails(): string[] {
  const raw = process.env.MAINTENANCE_BYPASS_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return parseAdminEmails().includes(e);
}

function isMaintenanceBypassEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  // Hardcoded allowlist for testing (also supports MAINTENANCE_BYPASS_EMAILS).
  const hardcoded = new Set(["achatibihajar1@gmail.com", "acwebdev1@gmail.com"]);
  return hardcoded.has(e) || parseMaintenanceBypassEmails().includes(e);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const supportEnabled = isTruthyEnv(process.env.NEXT_PUBLIC_ENABLE_SUPPORT_PAGE);
  if (!supportEnabled && (pathname === "/support" || pathname.startsWith("/support/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const maintenanceModeEnabled =
    isTruthyEnv(process.env.MAINTENANCE_MODE) || isTruthyEnv(process.env.NEXT_PUBLIC_MAINTENANCE_MODE);

  // Rate limit sign-in endpoints by IP (edge).
  if (pathname === "/login" || pathname.startsWith("/auth/callback")) {
    const ip = getRequestIp(request) ?? "unknown";
    const rl = await rateLimitSigninByIp(ip);
    if (!rl.ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("rate_limited", "1");
      url.searchParams.set("retry", String(rl.retryAfterSeconds));
      url.searchParams.set("kind", "ip");
      return NextResponse.redirect(url);
    }
  }

  const requiresAuth =
    pathname.startsWith("/chats") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/channel");

  // Always start with a passthrough response; Supabase may set refreshed cookies on it.
  const passThrough = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => passThrough.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If a user is banned, immediately sign them out and redirect to login.
  // (Bans are email-based; "social match" bans also insert into banned_users.)
  if (user?.email) {
    const { data: bannedRow } = await supabase
      .from("banned_users")
      .select("email")
      .eq("email", user.email.trim().toLowerCase())
      .maybeSingle();

    if (bannedRow?.email) {
      await supabase.auth.signOut();
      const bannedUrl = request.nextUrl.clone();
      bannedUrl.pathname = "/login";
      bannedUrl.searchParams.set("banned", "1");
      const redirect = NextResponse.redirect(bannedUrl);
      passThrough.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
      return redirect;
    }
  }

  // Maintenance mode: allow admins through, show maintenance to everyone else.
  if (maintenanceModeEnabled) {
    const allowWithoutAdmin =
      pathname === "/maintenance" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/") ||
      pathname === "/auth/callback";

    let allowDuringMaintenance = false;
    if (user) {
      const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      const isAdmin = data?.role === "admin" || isAdminEmail(user.email);
      allowDuringMaintenance = isAdmin || isMaintenanceBypassEmail(user.email);
    }

    // Block non-admin API calls during maintenance.
    if (!allowDuringMaintenance && pathname.startsWith("/api")) {
      return NextResponse.json({ error: "maintenance" }, { status: 503 });
    }

    // Rewrite non-admin traffic to maintenance (avoid loops).
    if (!allowDuringMaintenance && !allowWithoutAdmin) {
      const maintenanceUrl = request.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      const rewrite = NextResponse.rewrite(maintenanceUrl);
      passThrough.cookies.getAll().forEach(({ name, value }) => rewrite.cookies.set(name, value));
      return rewrite;
    }
  }

  if (requiresAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    passThrough.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
    return redirect;
  }

  if (pathname.startsWith("/admin") && user) {
    const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    const adminOk = data?.role === "admin" || isAdminEmail(user.email);
    if (!adminOk) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      const redirect = NextResponse.redirect(homeUrl);
      passThrough.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
      return redirect;
    }
  }

  // Chats page is admin-only (admin-to-user messaging). Non-admins are redirected.
  if (pathname.startsWith("/chats") && user) {
    const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
    const adminOk = data?.role === "admin" || isAdminEmail(user.email);
    if (!adminOk) {
      const ticketsUrl = request.nextUrl.clone();
      ticketsUrl.pathname = "/tickets";
      ticketsUrl.search = "";
      const redirect = NextResponse.redirect(ticketsUrl);
      passThrough.cookies.getAll().forEach(({ name, value }) => redirect.cookies.set(name, value));
      return redirect;
    }
  }

  return passThrough;
}

export const config = {
  // Run middleware for all non-asset routes so maintenance can apply site-wide.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\..*).*)"],
};
