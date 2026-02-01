import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { ticketId?: string; event?: string | null; seatPreference?: string | null }
    | null;

  const ticketId = String(body?.ticketId ?? "").trim();
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

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

  // Fetch authoritative username from the profile (prevents spoofing).
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  const requesterUsername = String(profile?.username ?? `ARMY-${user.id.slice(0, 8)}`);

  const { data, error } = await supabase
    .from("requests")
    .insert({
      ticket_id: ticketId,
      requester_id: user.id,
      requester_username: requesterUsername,
      event: (body?.event ?? "—") || "—",
      seat_preference: (body?.seatPreference ?? "—") || "—",
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

