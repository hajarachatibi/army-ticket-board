import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { verifyTurnstile } from "@/lib/turnstileServer";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { answers?: Record<string, string>; "cf-turnstile-response"?: string }
    | null;

  const ok = await verifyTurnstile(body?.["cf-turnstile-response"], getRequestIp(request));
  if (!ok) return NextResponse.json({ error: "Turnstile verification failed" }, { status: 403 });

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

  const answers = body?.answers ?? null;
  if (!answers || typeof answers !== "object") return NextResponse.json({ error: "Missing answers" }, { status: 400 });

  const { error } = await supabase.from("forum_submissions").insert({
    user_id: user.id,
    answers,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

