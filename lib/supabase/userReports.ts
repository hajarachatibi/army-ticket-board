import { supabase } from "@/lib/supabaseClient";

export async function insertUserReport(params: {
  reportedUserId: string;
  reporterId: string | null;
  reportedByUsername: string | null;
  reason: string;
  details?: string | null;
  imageUrl?: string | null;
}): Promise<{ error: string | null }> {
  try {
    // Submit via server route for BotID protection + server-side validation.
    void params.reporterId;
    void params.reportedByUsername;
    const res = await fetch("/api/reports/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId: params.reportedUserId,
        reason: params.reason,
        details: params.details ?? null,
        imageUrl: params.imageUrl ?? null,
      }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) return { error: j?.error ?? `HTTP ${res.status}` };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save user report" };
  }
}

