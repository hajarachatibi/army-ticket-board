import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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

  const requiresAuth = pathname.startsWith("/chats") || pathname.startsWith("/settings") || pathname.startsWith("/admin");
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
  matcher: ["/admin/:path*", "/chats/:path*", "/settings/:path*"],
};
