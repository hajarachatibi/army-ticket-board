import { supabase } from "@/lib/supabaseClient";

/** Fetch ticket IDs the current user has reported. Used for "Reported" filter in browse. */
export async function fetchReportedTicketIds(
  userId: string
): Promise<{ data: string[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("ticket_id")
      .eq("reporter_id", userId);

    if (error) return { data: [], error: error.message };
    const ids = (data ?? [])
      .map((r: { ticket_id: string }) => r.ticket_id)
      .filter((id): id is string => typeof id === "string");
    return { data: [...new Set(ids)], error: null };
  } catch (e) {
    return {
      data: [],
      error: e instanceof Error ? e.message : "Failed to fetch reported tickets",
    };
  }
}

export async function insertReport(params: {
  ticketId: string;
  reporterId: string | null;
  reportedByUsername: string | null;
  reason: string;
  details?: string | null;
}): Promise<{ error: string | null }> {
  try {
    // Submit via server route for BotID protection.
    void params.reporterId;
    void params.reportedByUsername;
    const res = await fetch("/api/reports/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: params.ticketId,
        reason: params.reason,
        details: params.details ?? null,
      }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) return { error: j?.error ?? `HTTP ${res.status}` };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save report" };
  }
}
