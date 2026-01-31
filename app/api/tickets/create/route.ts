import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { verifyTurnstile } from "@/lib/turnstileServer";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        turnstileToken?: string;
        event?: string;
        city?: string;
        day?: string;
        vip?: boolean;
        quantity?: number;
        section?: string;
        row?: string;
        seat?: string;
        type?: string;
        price?: number;
        currency?: string;
      }
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

  const qty = Math.min(4, Math.max(1, Number(body?.quantity ?? 1) || 1));
  const price = Math.max(0, Number(body?.price ?? 0) || 0);
  if (price <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      event: body?.event ?? "",
      city: body?.city ?? "",
      day: body?.day ?? "",
      vip: !!body?.vip,
      quantity: qty,
      section: body?.section ?? "",
      seat_row: body?.row ?? "",
      seat: body?.seat ?? "",
      type: body?.type ?? "Seat",
      status: "Available",
      owner_id: user.id,
      price,
      currency: body?.currency ?? "USD",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

