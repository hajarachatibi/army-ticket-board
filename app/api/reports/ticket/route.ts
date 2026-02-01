import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { ticketId?: string; reason?: string; details?: string | null }
    | null;

  const ticketId = String(body?.ticketId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const details = body?.details != null ? String(body.details) : null;
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Missing reason" }, { status: 400 });

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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  const reportedByUsername = String(profile?.username ?? user.email ?? `ARMY-${user.id.slice(0, 8)}`);

  const { error } = await supabase.from("reports").insert({
    ticket_id: ticketId,
    reporter_id: user.id,
    reported_by_username: reportedByUsername,
    reason,
    details,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

