import { createServerClient } from "@supabase/ssr";
import { checkBotId } from "botid/server";
import { NextResponse, type NextRequest } from "next/server";

import { sameOriginError } from "@/lib/security/sameOrigin";
import { validateAllSocials } from "@/lib/security/socialValidation";

// Uses server-only dependencies (BotID). Keep in Node.js runtime.
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
        firstName?: string;
        country?: string;
        is18Confirmed?: boolean;
        instagram?: string | null;
        facebook?: string | null;
        tiktok?: string | null;
        snapchat?: string | null;
        armyBiasAnswer?: string;
        armyYearsArmy?: string;
        armyFavoriteAlbum?: string;
        acceptTerms?: boolean;
        acceptUserAgreement?: boolean;
      }
    | null;

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

  const firstName = String(body?.firstName ?? "").trim();
  const country = String(body?.country ?? "").trim();
  const is18 = !!body?.is18Confirmed;
  const instagram = body?.instagram == null ? null : String(body.instagram).trim();
  const facebook = body?.facebook == null ? null : String(body.facebook).trim();
  const tiktok = body?.tiktok == null ? null : String(body.tiktok).trim();
  const snapchat = body?.snapchat == null ? null : String(body.snapchat).trim();
  const bias = String(body?.armyBiasAnswer ?? "").trim();
  const years = String(body?.armyYearsArmy ?? "").trim();
  const album = String(body?.armyFavoriteAlbum ?? "").trim();

  if (!firstName) return NextResponse.json({ error: "Missing first name" }, { status: 400 });
  if (!country) return NextResponse.json({ error: "Missing country" }, { status: 400 });
  if (!is18) return NextResponse.json({ error: "You must confirm 18+" }, { status: 400 });
  if (!instagram && !facebook && !tiktok && !snapchat) return NextResponse.json({ error: "Connect at least one social account" }, { status: 400 });
  const socialErr = validateAllSocials({
    instagram: instagram ?? "",
    facebook: facebook ?? "",
    tiktok: tiktok ?? "",
    snapchat: snapchat ?? "",
  });
  if (socialErr) return NextResponse.json({ error: socialErr }, { status: 400 });
  if (bias.length < 100) return NextResponse.json({ error: "Bias answer must be at least 100 characters" }, { status: 400 });
  if (!years) return NextResponse.json({ error: "Missing years ARMY" }, { status: 400 });
  if (!album) return NextResponse.json({ error: "Missing favorite album" }, { status: 400 });
  if (!body?.acceptTerms) return NextResponse.json({ error: "You must accept Terms" }, { status: 400 });
  if (!body?.acceptUserAgreement) return NextResponse.json({ error: "You must accept User Agreement" }, { status: 400 });

  const nowIso = new Date().toISOString();
  const update = {
    first_name: firstName,
    country,
    is_18_confirmed: true,
    instagram: instagram || null,
    facebook: facebook || null,
    tiktok: tiktok || null,
    snapchat: snapchat || null,
    army_bias_answer: bias,
    army_years_army: years,
    army_favorite_album: album,
    onboarding_completed_at: nowIso,
    terms_accepted_at: nowIso,
    user_agreement_accepted_at: nowIso,
  } as Record<string, any>;

  let { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("id", user.id);

  // If DB migrations aren't applied yet (e.g. tiktok/snapchat columns missing),
  // retry without those fields so the UI doesn't feel "stuck".
  if (error) {
    const msg = String(error.message ?? "");
    const missingTikTok = msg.toLowerCase().includes("column") && msg.toLowerCase().includes("tiktok");
    const missingSnap = msg.toLowerCase().includes("column") && msg.toLowerCase().includes("snapchat");
    if (missingTikTok || missingSnap) {
      delete update.tiktok;
      delete update.snapchat;
      const retry = await supabase.from("user_profiles").update(update).eq("id", user.id);
      error = retry.error ?? null;
    }
  }

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("user_profiles_onboarding_required_fields")) {
      return NextResponse.json(
        { error: "Please fill all required fields (including at least one social) and make sure your DB migrations are up to date." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return response;
}

