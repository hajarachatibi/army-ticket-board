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

  const service = createServiceClient();

  // Close connection + chat (if any) and mark sold.
  const { data: conn } = await service
    .from("connections")
    .select("id, chat_id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (conn?.chat_id) {
    await service.from("chats").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", conn.chat_id);
  }
  if (conn?.id) {
    await service.from("connections").update({ stage: "ended", stage_expires_at: new Date().toISOString() }).eq("id", conn.id);
  }

  const { error: upErr } = await service
    .from("listings")
    .update({ status: "sold", locked_by: null, locked_at: null, lock_expires_at: null })
    .eq("id", listingId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return response;
}

