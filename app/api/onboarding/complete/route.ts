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

  const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const body = rawBody
    ? {
        firstName: rawBody.firstName ?? rawBody.first_name,
        country: rawBody.country,
        is18Confirmed: rawBody.is18Confirmed ?? rawBody.is_18_confirmed,
        instagram: rawBody.instagram ?? null,
        facebook: rawBody.facebook ?? null,
        tiktok: rawBody.tiktok ?? null,
        snapchat: rawBody.snapchat ?? null,
        armyBiasAnswer: rawBody.armyBiasAnswer ?? rawBody.army_bias_answer,
        armyYearsArmy: rawBody.armyYearsArmy ?? rawBody.army_years_army,
        armyFavoriteAlbum: rawBody.armyFavoriteAlbum ?? rawBody.army_favorite_album,
        acceptTerms: rawBody.acceptTerms ?? rawBody.accept_terms,
        acceptUserAgreement: rawBody.acceptUserAgreement ?? rawBody.user_agreement_accepted,
      }
    : null;

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
  const bias = String(body?.armyBiasAnswer ?? "").trim();
  const years = String(body?.armyYearsArmy ?? "").trim();
  const album = String(body?.armyFavoriteAlbum ?? "").trim();

  if (!firstName) return NextResponse.json({ error: "Missing first name" }, { status: 400 });
  if (!country) return NextResponse.json({ error: "Missing country" }, { status: 400 });
  if (!is18) return NextResponse.json({ error: "You must confirm 18+" }, { status: 400 });
  if (!instagram && !facebook) return NextResponse.json({ error: "Connect at least one social (Instagram or Facebook)" }, { status: 400 });
  const socialErr = validateAllSocials({
    instagram: instagram ?? "",
    facebook: facebook ?? "",
  });
  if (socialErr) return NextResponse.json({ error: socialErr }, { status: 400 });
  if (!bias.trim()) return NextResponse.json({ error: "Bias / ARMY profile answer is required" }, { status: 400 });
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
    tiktok: null,
    snapchat: null,
    army_bias_answer: bias,
    army_years_army: years,
    army_favorite_album: album,
    onboarding_completed_at: nowIso,
    terms_accepted_at: nowIso,
    user_agreement_accepted_at: nowIso,
  };

  const { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    const friendlyMessage =
      "Setup couldn’t be saved. Please check that you’ve filled: first name, country, 18+ confirmation, at least one social (Instagram or Facebook — usernames only, no links), and all three ARMY profile answers (bias, years ARMY, favorite album). Then try again.";
    return NextResponse.json({ error: friendlyMessage }, { status: 400 });
  }
  return response;
}

