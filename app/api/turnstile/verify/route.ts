import { NextResponse, type NextRequest } from "next/server";
import { verifyTurnstile } from "@/lib/turnstileServer";
import { getRequestIp } from "@/lib/requestIp";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string; action?: string } | null;
  const ip = getRequestIp(request);
  const result = await verifyTurnstile({ token: body?.token, ip });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 429 });
  }
  const res = NextResponse.json({ ok: true });
  const action = (body?.action ?? "").trim();
  if (action) {
    // Short-lived proof that the challenge was solved for a specific action (used for OAuth signup).
    res.cookies.set(`ts_${action}`, String(Date.now()), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });
  }
  return res;
}

