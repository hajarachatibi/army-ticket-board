import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

function isValidTicketProofPath(path: string, userId: string, kind: "image" | "video"): boolean {
  const p = (path ?? "").trim();
  if (!p) return false;
  if (p.includes("://")) return false;
  if (p.includes("..")) return false;
  if (!p.startsWith(`ticket-proofs/${userId}/`)) return false;

  const lower = p.toLowerCase();
  if (kind === "image") return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        ticketId?: string;
        proofTmTicketPagePath?: string;
        proofTmScreenRecordingPath?: string | null;
        proofTmEmailScreenshotPath?: string;
        proofPriceNote?: string | null;
      }
    | null;

  const ticketId = String(body?.ticketId ?? "").trim();
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

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

  const proofTicketPage = String(body?.proofTmTicketPagePath ?? "").trim();
  const proofScreenRecordingRaw = body?.proofTmScreenRecordingPath;
  const proofScreenRecording =
    proofScreenRecordingRaw == null ? null : String(proofScreenRecordingRaw).trim();
  const proofEmailScreenshot = String(body?.proofTmEmailScreenshotPath ?? "").trim();
  const proofPriceNote = body?.proofPriceNote != null ? String(body.proofPriceNote) : null;

  if (!isValidTicketProofPath(proofTicketPage, user.id, "image")) {
    return NextResponse.json({ error: "Missing/invalid ticket page screenshot proof." }, { status: 400 });
  }
  if (!isValidTicketProofPath(proofEmailScreenshot, user.id, "image")) {
    return NextResponse.json({ error: "Missing/invalid email screenshot proof." }, { status: 400 });
  }
  if (proofScreenRecording && !isValidTicketProofPath(proofScreenRecording, user.id, "video")) {
    return NextResponse.json({ error: "Invalid screen recording proof." }, { status: 400 });
  }

  // Only allow sellers to attach proofs to their own pending tickets.
  const { data: existing, error: tErr } = await supabase
    .from("tickets")
    .select("id, owner_id, listing_status")
    .eq("id", ticketId)
    .single();
  if (tErr || !existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (existing.owner_id !== user.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (existing.listing_status !== "pending_review") {
    return NextResponse.json({ error: "Ticket is not pending review" }, { status: 400 });
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      proof_tm_ticket_page_path: proofTicketPage,
      proof_tm_screen_recording_path: proofScreenRecording || null,
      proof_tm_email_screenshot_path: proofEmailScreenshot,
      proof_price_note: proofPriceNote,
    })
    .eq("id", ticketId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

