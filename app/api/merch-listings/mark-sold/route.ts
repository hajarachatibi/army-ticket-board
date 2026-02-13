import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/serviceClient";
import { sameOriginError } from "@/lib/security/sameOrigin";

export const runtime = "nodejs";

const ACTIVE_MERCH_STAGES = [
  "pending_seller",
  "bonding",
  "buyer_bonding_v2",
  "preview",
  "comfort",
  "social",
  "agreement",
  "chat_open",
] as const;

export async function POST(request: NextRequest) {
  const so = sameOriginError(request);
  if (so) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { merchListingId?: string } | null;
  const merchListingId = String(body?.merchListingId ?? "").trim();
  if (!merchListingId) return NextResponse.json({ error: "Missing merchListingId" }, { status: 400 });

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
    .from("merch_listings")
    .select("id")
    .eq("id", merchListingId)
    .eq("seller_id", user.id)
    .single();
  if (lErr || !listing) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let service;
  try {
    service = createServiceClient();
  } catch {
    // Fallback: use anon client and end each connection via RPC (seller is participant).
    const { error: upErr } = await supabase
      .from("merch_listings")
      .update({ status: "sold" })
      .eq("id", merchListingId)
      .eq("seller_id", user.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const { data: conns } = await supabase
      .from("merch_connections")
      .select("id")
      .eq("merch_listing_id", merchListingId)
      .eq("seller_id", user.id)
      .in("stage", [...ACTIVE_MERCH_STAGES]);

    for (const c of (conns ?? []) as { id: string }[]) {
      await supabase.rpc("end_merch_connection", {
        p_connection_id: c.id,
        p_ended_reason: "The listing was marked as sold.",
      });
    }

    return response;
  }

  // Mark sold: end ALL active merch connections for this listing. Notify each buyer.
  const { data: conns } = await service
    .from("merch_connections")
    .select("id, buyer_id, stage")
    .eq("merch_listing_id", merchListingId)
    .in("stage", [...ACTIVE_MERCH_STAGES]);

  const { data: listRow } = await service
    .from("merch_listings")
    .select("title")
    .eq("id", merchListingId)
    .single();
  const listingSummary = listRow?.title ? String(listRow.title).trim() || "Merch listing" : "Merch listing";

  const now = new Date().toISOString();
  for (const c of (conns ?? []) as { id: string; buyer_id: string; stage: string }[]) {
    await service
      .from("merch_connections")
      .update({
        stage: "ended",
        stage_expires_at: now,
        ended_by: user.id,
        ended_at: now,
        stage_before_ended: c.stage,
      })
      .eq("id", c.id);

    await service.from("user_notifications").insert({
      user_id: c.buyer_id,
      type: "connection_ended",
      message: "The listing was marked as sold.",
      listing_summary: listingSummary,
      merch_listing_id: merchListingId,
      merch_connection_id: c.id,
    });
  }

  const { error: upErr } = await service.from("merch_listings").update({ status: "sold" }).eq("id", merchListingId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return response;
}
