import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return unauthorized();

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const supabase = createServiceClient();

  const results: Record<string, any> = {};

  const timeouts = await supabase.rpc("process_connection_timeouts");
  results.process_connection_timeouts = timeouts.error ? { ok: false, error: timeouts.error.message } : { ok: true, data: timeouts.data };

  const inactiveChats = await supabase.rpc("process_inactive_connection_chats");
  results.process_inactive_connection_chats = inactiveChats.error
    ? { ok: false, error: inactiveChats.error.message }
    : { ok: true, data: inactiveChats.data };

  return NextResponse.json({ ok: true, results });
}

