import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isBannedEmail } from "@/lib/supabase/banned";
import { ensureGoogleProfile, touchLastLogin } from "@/lib/supabase/profile";
import { rateLimitSigninByAccount } from "@/lib/rateLimit";

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

    // Rate limit sign-ins by account (after we know the user).
    const acctKey = session.user.id || email.toLowerCase();
    const rl = await rateLimitSigninByAccount(acctKey);
    if (!rl.ok) {
      await supabase.auth.signOut();
      const limitedUrl = new URL("/login", origin);
      limitedUrl.searchParams.set("rate_limited", "1");
      limitedUrl.searchParams.set("retry", String(rl.retryAfterSeconds));
      limitedUrl.searchParams.set("kind", "account");
      redirectResponse.headers.set("Location", limitedUrl.toString());
      return redirectResponse;
    }

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
      const countryCode =
        request.headers.get("x-vercel-ip-country") ??
        (request as NextRequest & { geo?: { country?: string } }).geo?.country ??
        null;
      await touchLastLogin(session.user.id, session.access_token, countryCode);
    } catch (e) {
      if (process.env.NODE_ENV === "development") console.error("[Auth callback] ensureGoogleProfile", e);
    }
  }

  return redirectResponse;
}
