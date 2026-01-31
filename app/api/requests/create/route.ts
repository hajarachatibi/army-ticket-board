import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { verifyTurnstile } from "@/lib/turnstileServer";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { ticketId?: string; event?: string; seatPreference?: string; turnstileToken?: string }
    | null;

  const ip = getRequestIp(request);
  const v = await verifyTurnstile({ token: body?.turnstileToken, ip });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 403 });

  const passThrough = NextResponse.json({ ok: true });
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
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const ticketId = String(body?.ticketId ?? "").trim();
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

  const { data: profile } = await supabase.from("user_profiles").select("username").eq("id", user.id).single();
  const requesterUsername = String(profile?.username ?? user.email ?? `user-${user.id.slice(0, 8)}`);

  const { data, error } = await supabase
    .from("requests")
    .insert({
      ticket_id: ticketId,
      requester_id: user.id,
      requester_username: requesterUsername,
      event: body?.event ?? "—",
      seat_preference: body?.seatPreference ?? "—",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

