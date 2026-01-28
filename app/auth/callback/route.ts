import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isBannedEmail } from "@/lib/supabase/banned";
import { ensureGoogleProfile, touchLastLogin } from "@/lib/supabase/profile";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = request.nextUrl.origin;
  const redirectTo = new URL("/tickets", origin);
  const loginUrl = new URL("/login", origin);

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (process.env.NODE_ENV === "development") console.error("[Auth callback]", error);
    redirectResponse.headers.set("Location", loginUrl.toString());
    return redirectResponse;
  }

  if (session) {
    const email = session.user?.email ?? "";
    const banned = await isBannedEmail(email, session.access_token);
    if (banned) {
      await supabase.auth.signOut();
      const bannedUrl = new URL("/login", origin);
      bannedUrl.searchParams.set("banned", "1");
      redirectResponse.headers.set("Location", bannedUrl.toString());
      return redirectResponse;
    }
    try {
      await ensureGoogleProfile(session);
      await touchLastLogin(session.user.id, session.access_token);
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error("[Auth callback] ensureGoogleProfile", e);
    }
  }

  return redirectResponse;
}
