import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/serviceClient";
import { sameOriginError } from "@/lib/security/sameOrigin";

type SeatInput = {
  section?: string;
  row?: string;
  seat?: string;
  faceValuePrice?: number;
  currency?: string;
};

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
        listingId?: string;
        concertCity?: string;
        concertDate?: string; // YYYY-MM-DD
        ticketSource?: string;
        ticketingExperience?: string;
        sellingReason?: string;
        priceExplanation?: string | null;
        seats?: SeatInput[];
      }
    | null;

  const listingId = String(body?.listingId ?? "").trim();
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

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

  // Seller-only: verify ownership via RLS-safe query and ensure editable.
  const { data: listing, error: lErr } = await supabase
    .from("listings")
    .select("id, status, locked_by")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();
  if (lErr || !listing) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (listing.locked_by) return NextResponse.json({ error: "This listing is currently locked by a connection." }, { status: 400 });
  if (listing.status === "sold" || listing.status === "removed") {
    return NextResponse.json({ error: "Sold/removed listings cannot be edited." }, { status: 400 });
  }

  const concertCity = String(body?.concertCity ?? "").trim();
  const concertDate = String(body?.concertDate ?? "").trim();
  const ticketSource = String(body?.ticketSource ?? "").trim();
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

  const service = createServiceClient();

  const { error: upErr } = await service
    .from("listings")
    .update({
      concert_city: concertCity,
      concert_date: concertDate,
      ticket_source: ticketSource,
      ticketing_experience: ticketingExperience,
      selling_reason: sellingReason,
      price_explanation: priceExplanation || null,
    })
    .eq("id", listingId)
    .eq("seller_id", user.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { error: delErr } = await service.from("listing_seats").delete().eq("listing_id", listingId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  const { error: seatsErr } = await service.from("listing_seats").insert(
    seats.map((s, idx) => ({
      listing_id: listingId,
      seat_index: idx + 1,
      section: s.section,
      seat_row: s.row,
      seat: s.seat,
      face_value_price: s.faceValuePrice,
      currency: s.currency,
    }))
  );
  if (seatsErr) return NextResponse.json({ error: seatsErr.message }, { status: 400 });

  return response;
}

