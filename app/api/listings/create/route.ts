import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { sameOriginError } from "@/lib/security/sameOrigin";

type SeatInput = {
  section?: string;
  row?: string;
  seat?: string;
  faceValuePrice?: number;
  currency?: string;
};

// Uses server-only dependencies (BotID). Keep in Node.js runtime.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const so = sameOriginError(request);
  if (so) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        concertCity?: string;
        concertDate?: string; // YYYY-MM-DD
        ticketSource?: string;
        vip?: boolean;
        ticketingExperience?: string;
        sellingReason?: string;
        priceExplanation?: string | null;
        seats?: SeatInput[];
      }
    | null;

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

  // Rate limit posting: max 2 listings per 48 hours (friendly pre-check; DB trigger enforces too).
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .gte("created_at", since);
  if ((recentCount ?? 0) >= 2) {
    return NextResponse.json(
      { error: "You can only post 2 listings within 48 hours. Please wait before posting another." },
      { status: 429 }
    );
  }

  const concertCity = String(body?.concertCity ?? "").trim();
  const concertDate = String(body?.concertDate ?? "").trim();
  const ticketSource = String(body?.ticketSource ?? "").trim();
  const vip = Boolean(body?.vip);
  const ticketingExperience = String(body?.ticketingExperience ?? "").trim();
  const sellingReason = String(body?.sellingReason ?? "").trim();
  const priceExplanationRaw = body?.priceExplanation;
  const priceExplanation = priceExplanationRaw == null ? null : String(priceExplanationRaw).trim();
  const seatsRaw = Array.isArray(body?.seats) ? body!.seats! : [];

  if (!concertCity) return NextResponse.json({ error: "Missing concert city" }, { status: 400 });
  if (!concertDate) return NextResponse.json({ error: "Missing concert date" }, { status: 400 });
  if (!ticketSource) return NextResponse.json({ error: "Missing ticket source" }, { status: 400 });
  if (!ticketingExperience) return NextResponse.json({ error: "Missing ticketing experience" }, { status: 400 });
  if (!sellingReason) return NextResponse.json({ error: "Missing reason for selling" }, { status: 400 });

  const seats = seatsRaw
    .map((s) => ({
      section: String(s.section ?? "").trim(),
      row: String(s.row ?? "").trim(),
      seat: String(s.seat ?? "").trim(),
      faceValuePrice: Math.max(0, Number(s.faceValuePrice ?? 0) || 0),
      currency: String(s.currency ?? "USD").trim() || "USD",
    }))
    .filter((s) => s.section || s.row || s.seat || s.faceValuePrice > 0);

  if (seats.length < 1) return NextResponse.json({ error: "Add at least 1 seat" }, { status: 400 });
  if (seats.length > 4) return NextResponse.json({ error: "Maximum 4 seats per listing" }, { status: 400 });
  if (seats.some((s) => !s.section || !s.row || !s.seat)) return NextResponse.json({ error: "Each seat needs section, row, seat" }, { status: 400 });
  if (seats.some((s) => s.faceValuePrice <= 0)) return NextResponse.json({ error: "Each seat needs a face value price" }, { status: 400 });

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      concert_city: concertCity,
      concert_date: concertDate,
      ticket_source: ticketSource,
      vip,
      ticketing_experience: ticketingExperience,
      selling_reason: sellingReason,
      price_explanation: priceExplanation || null,
      status: "processing",
      processing_until: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (listingErr) return NextResponse.json({ error: listingErr.message }, { status: 400 });

  const { error: seatsErr } = await supabase.from("listing_seats").insert(
    seats.map((s, idx) => ({
      listing_id: listing.id,
      seat_index: idx + 1,
      section: s.section,
      seat_row: s.row,
      seat: s.seat,
      face_value_price: s.faceValuePrice,
      currency: s.currency,
    }))
  );

  if (seatsErr) return NextResponse.json({ error: seatsErr.message }, { status: 400 });
  return NextResponse.json({ data: { listingId: listing.id } });
}

