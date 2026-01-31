import { supabase } from "@/lib/supabaseClient";

export async function insertUserReport(params: {
  reportedUserId: string;
  reporterId: string | null;
  reportedByUsername: string | null;
  reason: string;
  details?: string | null;
  imageUrl?: string | null;
  turnstileToken?: string | null;
}): Promise<{ error: string | null }> {
  try {
    if (params.turnstileToken) {
      const res = await fetch("/api/reports/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportedUserId: params.reportedUserId,
          reason: params.reason,
          details: params.details ?? null,
          imageUrl: params.imageUrl ?? null,
          turnstileToken: params.turnstileToken,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) return { error: j?.error ?? `HTTP ${res.status}` };
      return { error: null };
    }

    const { error } = await supabase.from("user_reports").insert({
      reported_user_id: params.reportedUserId,
      reporter_id: params.reporterId,
      reported_by_username: params.reportedByUsername,
      reason: params.reason,
      details: params.details ?? null,
      image_url: params.imageUrl ?? null,
    });
    return { error: error?.message ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save user report" };
  }
}

