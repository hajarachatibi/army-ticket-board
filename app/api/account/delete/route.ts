import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/serviceClient";
import { sameOriginError } from "@/lib/security/sameOrigin";

// Uses Supabase service role (server-only). Keep in Node.js runtime.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const so = sameOriginError(request);
  if (so) return NextResponse.json({ ok: false, error: "Bad origin" }, { status: 403 });

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
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const userId = user.id;

  // Sign out first so cookies/tokens are cleared for this browser.
  await supabase.auth.signOut();

  // Then permanently delete the auth user (cascades to user_profiles via FK).
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return response;
}

