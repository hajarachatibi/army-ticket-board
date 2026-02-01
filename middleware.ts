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

function isAdminEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return parseAdminEmails().includes(e);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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

  // Maintenance mode: allow admins through, show maintenance to everyone else.
  if (maintenanceModeEnabled) {
    const allowWithoutAdmin =
      pathname === "/maintenance" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/") ||
      pathname === "/auth/callback";

    let isAdmin = false;
    if (user) {
      const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      isAdmin = data?.role === "admin" || isAdminEmail(user.email);
    }

    // Block non-admin API calls during maintenance.
    if (!isAdmin && pathname.startsWith("/api")) {
      return NextResponse.json({ error: "maintenance" }, { status: 503 });
    }

    // Rewrite non-admin traffic to maintenance (avoid loops).
    if (!isAdmin && !allowWithoutAdmin) {
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

  return passThrough;
}

export const config = {
  // Run middleware for all non-asset routes so maintenance can apply site-wide.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\..*).*)"],
};
