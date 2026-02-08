import { NextResponse } from "next/server";
import { runProcessPush } from "@/lib/processPushRunner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runProcessPush();
  return NextResponse.json(result);
}
