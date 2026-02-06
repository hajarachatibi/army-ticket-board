import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/serviceClient";
import { sameOriginError } from "@/lib/security/sameOrigin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const so = sameOriginError(request);
  if (so) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { listingId?: string } | null;
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

  // Seller-only: verify ownership via RLS-safe query.
  const { data: listing, error: lErr } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();
  if (lErr || !listing) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let service: ReturnType<typeof createServiceClient> | null = null;
  try {
    service = createServiceClient();
  } catch {
    // Fallback when service role is not configured: use user's session.
  }

  if (service) {
    // End all connections for this listing; notify each buyer (seller already knows they removed it).
    const { data: conns } = await service
      .from("connections")
      .select("id, buyer_id, chat_id")
      .eq("listing_id", listingId);

    const { data: listRow } = await service
      .from("listings")
      .select("concert_city, concert_date")
      .eq("id", listingId)
      .single();
    const listingSummary =
      [listRow?.concert_city, listRow?.concert_date].filter(Boolean).join(" · ") || "Listing";

    for (const conn of conns ?? []) {
      const c = conn as { id: string; buyer_id: string; chat_id?: string | null };
      if (c.chat_id) {
        await service.from("chats").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", c.chat_id);
      }
      await service.from("connections").update({ stage: "ended", stage_expires_at: new Date().toISOString() }).eq("id", c.id);
      await service.from("user_notifications").insert({
        user_id: c.buyer_id,
        type: "connection_ended",
        message: "The seller removed the listing.",
        listing_id: listingId,
        listing_summary: listingSummary,
        connection_id: c.id,
      });
    }

    const { error: upErr } = await service
      .from("listings")
      .update({ status: "removed", locked_by: null, locked_at: null, lock_expires_at: null })
      .eq("id", listingId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  } else {
    // No service role: end connections via RPC (as seller), then soft-delete listing with user client.
    const { data: conns } = await supabase
      .from("connections")
      .select("id")
      .eq("listing_id", listingId)
      .eq("seller_id", user.id)
      .in("stage", ["pending_seller", "bonding", "preview", "comfort", "social", "agreement", "chat_open"]);

    for (const c of (conns ?? []) as { id: string }[]) {
      await supabase.rpc("end_connection", {
        p_connection_id: c.id,
        p_ended_reason: "The seller removed the listing.",
      });
    }

    const { error: upErr } = await supabase
      .from("listings")
      .update({ status: "removed", locked_by: null, locked_at: null, lock_expires_at: null })
      .eq("id", listingId)
      .eq("seller_id", user.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  return response;
}

