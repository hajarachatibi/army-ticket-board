import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { ARIRANG_CITIES } from "@/lib/data/arirang";
import { parsePrice } from "@/lib/parsePrice";
import { sameOriginError } from "@/lib/security/sameOrigin";

type SeatInput = {
  section?: string;
  row?: string;
  seat?: string;
  faceValuePrice?: number | string;
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
        vip?: boolean;
        loge?: boolean;
        suite?: boolean;
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
  const vip = body?.vip !== undefined ? Boolean(body.vip) : undefined;
  const loge = body?.loge !== undefined ? Boolean(body.loge) : undefined;
  const suite = body?.suite !== undefined ? Boolean(body.suite) : undefined;
  const ticketingExperience = String(body?.ticketingExperience ?? "").trim();
  const sellingReason = String(body?.sellingReason ?? "").trim();
  const priceExplanationRaw = body?.priceExplanation;
  const priceExplanation = priceExplanationRaw == null ? null : String(priceExplanationRaw).trim();
  const seatsRaw = Array.isArray(body?.seats) ? body!.seats! : [];
  if (seatsRaw.length === 0) {
    return NextResponse.json(
      { error: "Add at least one seat with section, row, seat and price." },
      { status: 400 }
    );
  }

  if (!concertCity) return NextResponse.json({ error: "Missing concert city" }, { status: 400 });
  if (!(ARIRANG_CITIES as readonly string[]).includes(concertCity)) {
    return NextResponse.json({ error: "Concert city must be selected from the list" }, { status: 400 });
  }
  if (!concertDate) return NextResponse.json({ error: "Missing concert date" }, { status: 400 });
  if (!ticketSource) return NextResponse.json({ error: "Missing ticket source" }, { status: 400 });
  if (!ticketingExperience) return NextResponse.json({ error: "Missing ticketing experience" }, { status: 400 });
  if (!sellingReason) return NextResponse.json({ error: "Missing reason for selling" }, { status: 400 });

  const seats = seatsRaw
    .map((s) => ({
      section: String(s.section ?? "").trim(),
      row: String(s.row ?? "").trim(),
      seat: String(s.seat ?? "").trim(),
      faceValuePrice: Math.max(0, parsePrice(s.faceValuePrice) || 0),
      currency: String(s.currency ?? "USD").trim() || "USD",
    }))
    .filter((s) => s.section || s.row || s.seat || s.faceValuePrice > 0);

  if (seats.length < 1) return NextResponse.json({ error: "Add at least 1 seat" }, { status: 400 });
  if (seats.length > 4) return NextResponse.json({ error: "Maximum 4 seats per listing" }, { status: 400 });
  if (seats.some((s) => !s.section || !s.row || !s.seat)) return NextResponse.json({ error: "Each seat needs section, row, seat" }, { status: 400 });
  if (seats.some((s) => s.faceValuePrice <= 0)) return NextResponse.json({ error: "Each seat needs a face value price" }, { status: 400 });

  // Atomic update: listing row + replace seats in one transaction (avoids leaving listing with 0 seats).
  const { error: rpcErr } = await supabase.rpc("update_listing_with_seats", {
    p_listing_id: listingId,
    p_concert_city: concertCity,
    p_concert_date: concertDate,
    p_ticket_source: ticketSource,
    p_ticketing_experience: ticketingExperience,
    p_selling_reason: sellingReason,
    p_price_explanation: priceExplanation ?? "",
    p_vip: vip ?? false,
    p_loge: loge ?? false,
    p_suite: suite ?? false,
    p_seats: seats.map((s) => ({
      section: s.section,
      row: s.row,
      seat: s.seat,
      faceValuePrice: s.faceValuePrice,
      currency: s.currency,
    })),
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  return response;
}

