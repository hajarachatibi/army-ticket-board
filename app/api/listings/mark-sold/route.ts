import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/serviceClient";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  let service;
  try {
    service = createServiceClient();
  } catch (e) {
    // Fallback for environments without service role:
    // - Seller can update their own listing via RLS.
    // - End any active connections via the SECURITY DEFINER end_connection() RPC (as the seller).
    const { error: upErr } = await supabase
      .from("listings")
      .update({ status: "sold", locked_by: null, locked_at: null, lock_expires_at: null })
      .eq("id", listingId)
      .eq("seller_id", user.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const { data: conns } = await supabase
      .from("connections")
      .select("id")
      .eq("listing_id", listingId)
      .eq("seller_id", user.id)
      .in("stage", ["pending_seller", "bonding", "preview", "comfort", "social", "agreement", "chat_open"]);

    for (const c of (conns ?? []) as any[]) {
      await supabase.rpc("end_connection", { p_connection_id: c.id });
    }

    return response;
  }

  // Mark sold: end ALL active connections/requests for this listing.
  const { data: conns } = await service
    .from("connections")
    .select("id, chat_id")
    .eq("listing_id", listingId)
    .in("stage", ["pending_seller", "bonding", "preview", "comfort", "social", "agreement", "chat_open"]);

  for (const c of (conns ?? []) as any[]) {
    if (c.chat_id) {
      await service.from("chats").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", c.chat_id);
    }
    await service.from("connections").update({ stage: "ended", stage_expires_at: new Date().toISOString() }).eq("id", c.id);
  }

  const { error: upErr } = await service
    .from("listings")
    .update({ status: "sold", locked_by: null, locked_at: null, lock_expires_at: null })
    .eq("id", listingId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return response;
}

