import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 65;

/**
 * Admin-only: run the push/listing-alerts job and return the result.
 * Use this to verify cron and FCM are working (e.g. from Admin → Cron / Push).
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

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });

  const base = new URL(request.url).origin;
  try {
    const res = await fetch(`${base}/api/notifications/process-push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { _raw: text.slice(0, 2000) };
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "process-push failed",
          status: res.status,
          statusText: res.statusText,
          body,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(typeof body === "object" && body !== null ? body : { result: body });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to run process-push", message: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
