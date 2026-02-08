import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { runProcessPush } from "@/lib/processPushRunner";

export const runtime = "nodejs";
export const maxDuration = 65;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function runCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return unauthorized();

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const supabase = createServiceClient();

  const results: Record<string, unknown> = {};

  const timeouts = await supabase.rpc("process_connection_timeouts");
  results.process_connection_timeouts = timeouts.error ? { ok: false, error: timeouts.error.message } : { ok: true, data: timeouts.data };

  const inactiveChats = await supabase.rpc("process_inactive_connection_chats");
  results.process_inactive_connection_chats = inactiveChats.error
    ? { ok: false, error: inactiveChats.error.message }
    : { ok: true, data: inactiveChats.data };

  try {
    results.process_push = await runProcessPush(supabase);
  } catch (e) {
    results.process_push = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
