import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { verifyTurnstile } from "@/lib/turnstileServer";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { reportedUserId?: string; reason?: string; details?: string | null; imageUrl?: string | null; turnstileToken?: string }
    | null;

  const ip = getRequestIp(request);
  const v = await verifyTurnstile({ token: body?.turnstileToken, ip });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 403 });

  const response = NextResponse.json({ ok: true });
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

  const reportedUserId = String(body?.reportedUserId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  if (!reportedUserId || !reason) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: profile } = await supabase.from("user_profiles").select("username").eq("id", user.id).single();
  const reportedByUsername = String(profile?.username ?? user.email ?? `user-${user.id.slice(0, 8)}`);

  const { error } = await supabase.from("user_reports").insert({
    reported_user_id: reportedUserId,
    reporter_id: user.id,
    reported_by_username: reportedByUsername,
    reason,
    details: body?.details ?? null,
    image_url: body?.imageUrl ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

