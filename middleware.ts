import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { rateLimitSigninByIp } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const maintenanceModeEnabled =
    isTruthyEnv(process.env.MAINTENANCE_MODE) || isTruthyEnv(process.env.NEXT_PUBLIC_MAINTENANCE_MODE);

  if (maintenanceModeEnabled) {
    // Avoid rewrite loops.
    if (pathname !== "/maintenance") {
      const maintenanceUrl = request.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      return NextResponse.rewrite(maintenanceUrl);
    }
    return NextResponse.next({ request });
  }

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
    if (data?.role !== "admin") {
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
